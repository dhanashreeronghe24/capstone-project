import { PaymentMethod, PaymentTransaction, Prisma, Refund } from '@prisma/client';
import { prisma, TxClient } from '../../config/prisma.client';
import { forbidden, notFound, unprocessable } from '../../utils/http-error';
import { num, round2 } from '../../utils/money';
import { deductStock, transitionOrder } from '../order/order.lifecycle';
import { MockPaymentGatewayAdapter } from './adapters/mock-payment-gateway.adapter';
import { PaymentGatewayAdapter, VerifyPaymentResult } from './adapters/payment-gateway.interface';
import { ConfirmPaymentInput, InitiatePaymentInput, RefundInput, WebhookInput } from './payment.schema';

/** Business logic only talks to the adapter port; swap this binding to go live with a real gateway. */
export const paymentGateway: PaymentGatewayAdapter = new MockPaymentGatewayAdapter();

export const toPaymentView = (p: PaymentTransaction) => ({
  id: p.id,
  orderId: p.orderId,
  gatewayOrderId: p.gatewayOrderId,
  gatewayPaymentId: p.gatewayPaymentId,
  paymentMethod: p.paymentMethod,
  amount: num(p.amount),
  currency: p.currency,
  status: p.status,
  errorMessage: p.errorMessage,
  createdAt: p.createdAt,
});

const toRefundView = (r: Refund) => ({
  id: r.id,
  paymentId: r.paymentId,
  orderId: r.orderId,
  refundAmount: num(r.refundAmount),
  gatewayRefundId: r.gatewayRefundId,
  reason: r.reason,
  status: r.status,
  createdAt: r.createdAt,
});

/**
 * Refunds up to the remaining refundable amount of a successful payment. Runs in the caller's
 * transaction so cancellations / returns stay atomic. Marks the payment REFUNDED when fully refunded.
 */
export async function executeRefund(
  tx: TxClient,
  payment: PaymentTransaction,
  amount: number | undefined,
  reason: string,
): Promise<Refund> {
  if (payment.status !== 'SUCCESS' || !payment.gatewayPaymentId) {
    throw unprocessable('Only successful payments can be refunded');
  }
  const agg = await tx.refund.aggregate({
    where: { paymentId: payment.id, status: 'PROCESSED' },
    _sum: { refundAmount: true },
  });
  const remaining = round2(num(payment.amount) - num(agg._sum.refundAmount));
  const refundAmount = amount ?? remaining;
  if (refundAmount <= 0 || refundAmount > remaining) {
    throw unprocessable(`Refund amount must be between 0.01 and ${remaining.toFixed(2)}`);
  }
  const result = await paymentGateway.processRefund({
    gatewayPaymentId: payment.gatewayPaymentId,
    amount: refundAmount,
    reason,
  });
  const refund = await tx.refund.create({
    data: {
      paymentId: payment.id,
      orderId: payment.orderId,
      refundAmount,
      gatewayRefundId: result.gatewayRefundId,
      reason,
      status: result.status,
    },
  });
  if (result.status === 'PROCESSED' && round2(refundAmount) === remaining) {
    await tx.paymentTransaction.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
  }
  return refund;
}

async function loadOwnedPayment(userId: string, paymentId: string): Promise<PaymentTransaction> {
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment) throw notFound('Payment not found');
  if (payment.order.userId !== userId) throw forbidden('This payment belongs to another customer');
  return payment;
}

/**
 * Persists a gateway verdict. SUCCESS moves the order to CONFIRMED and deducts stock in the same
 * transaction. Idempotent: a payment that already succeeded is returned unchanged.
 */
async function applyResult(paymentId: string, result: VerifyPaymentResult) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentTransaction.updateMany({
      where: { id: paymentId, status: { in: ['PENDING', 'FAILED'] } },
      data: {
        status: result.status,
        gatewayPaymentId: result.gatewayPaymentId ?? null,
        gatewayResponseRaw: result.raw as Prisma.InputJsonValue,
        errorMessage: result.errorMessage ?? null,
      },
    });
    const payment = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId } });
    if (claimed.count === 1 && result.status === 'SUCCESS') {
      await transitionOrder(tx, payment.orderId, 'CONFIRMED', `Payment ${payment.gatewayPaymentId} succeeded`);
      await deductStock(tx, payment.orderId);
    }
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    return { payment: toPaymentView(payment), orderStatus: order.status };
  });
}

export const paymentService = {
  /** Creates (or returns the existing open) payment intent for an unpaid order. */
  async initiate(userId: string, input: InitiatePaymentInput) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw notFound('Order not found');
    if (order.userId !== userId) throw forbidden('This order belongs to another customer');
    if (order.status !== 'PAYMENT_PENDING') {
      throw unprocessable(`Order is ${order.status}; payment can only be initiated for PAYMENT_PENDING orders`);
    }
    const existing = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, paymentMethod: input.paymentMethod as PaymentMethod, status: 'PENDING' },
    });
    if (existing) return toPaymentView(existing);

    const { gatewayOrderId } = await paymentGateway.initiatePayment({
      orderId: order.id,
      amount: num(order.totalAmount),
      currency: 'INR',
      method: input.paymentMethod,
    });
    const created = await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        gatewayOrderId,
        paymentMethod: input.paymentMethod,
        amount: order.totalAmount,
        currency: 'INR',
        status: 'PENDING',
      },
    });
    return toPaymentView(created);
  },

  async confirm(userId: string, input: ConfirmPaymentInput) {
    const payment = await loadOwnedPayment(userId, input.paymentId);
    if (payment.status === 'SUCCESS') {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      return { payment: toPaymentView(payment), orderStatus: order.status };
    }
    if (payment.status === 'REFUNDED') throw unprocessable('Payment has already been refunded');
    if (payment.paymentMethod !== input.paymentMethod) {
      throw unprocessable(`Payment was initiated for ${payment.paymentMethod}, not ${input.paymentMethod}`);
    }
    const order = await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    if (order.status !== 'PAYMENT_PENDING') throw unprocessable(`Order is ${order.status}; it cannot be paid`);

    const result = await paymentGateway.verifyPayment({
      gatewayOrderId: payment.gatewayOrderId,
      method: payment.paymentMethod,
      instrument: { card: input.card, upiId: input.upiId, walletId: input.walletId },
    });
    return applyResult(payment.id, result);
  },

  async handleWebhook(input: WebhookInput) {
    const payment = await prisma.paymentTransaction.findFirst({ where: { gatewayOrderId: input.gatewayOrderId } });
    if (!payment) throw notFound('Payment not found for gateway order');
    const result = await paymentGateway.processWebhook(input);
    return applyResult(payment.id, result);
  },

  async refund(paymentId: string, input: RefundInput) {
    const refund = await prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({ where: { id: paymentId } });
      if (!payment) throw notFound('Payment not found');
      const created = await executeRefund(tx, payment, input.amount, input.reason);
      // A fully refunded RETURNED order is complete.
      const fresh = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId } });
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      if (fresh.status === 'REFUNDED' && order.status === 'RETURNED') {
        await transitionOrder(tx, order.id, 'REFUNDED', 'Refund processed');
      }
      return created;
    });
    return toRefundView(refund);
  },
};

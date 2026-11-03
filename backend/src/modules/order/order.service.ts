import { randomBytes } from 'crypto';
import { Order, OrderStatus, Prisma } from '@prisma/client';
import { prisma, TxClient } from '../../config/prisma.client';
import { forbidden, HttpError, notFound, unprocessable } from '../../utils/http-error';
import { num, toDateOnly } from '../../utils/money';
import { CartOwner, cartService } from '../cart/cart.service';
import { executeRefund, toPaymentView } from '../payment/payment.service';
import { shippingService } from '../shipping/shipping.service';
import { computePricing, evaluateCoupon } from './checkout.service';
import { restoreStock, transitionOrder } from './order.lifecycle';
import {
  CancelOrderInput,
  CheckoutSummaryInput,
  CreateOrderInput,
  OrderListQuery,
  ReturnOrderInput,
  UpdateStatusInput,
} from './order.schema';

/** Customers may return within this many days of delivery. */
const RETURN_WINDOW_DAYS = 7;
const CANCELLABLE: OrderStatus[] = ['CREATED', 'PAYMENT_PENDING', 'CONFIRMED', 'PROCESSING'];
const STAFF_TARGETS: OrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED'];

const orderInclude = {
  items: true,
  history: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' } },
  shipment: true,
} satisfies Prisma.OrderInclude;
type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const newOrderNumber = (): string =>
  `BW-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

export const toOrderView = (o: FullOrder) => ({
  id: o.id,
  orderNumber: o.orderNumber,
  status: o.status,
  subtotalAmount: num(o.subtotalAmount),
  taxAmount: num(o.taxAmount),
  shippingFee: num(o.shippingFee),
  discountAmount: num(o.discountAmount),
  totalAmount: num(o.totalAmount),
  couponCode: o.couponCode,
  pointsRedeemed: o.pointsRedeemed,
  shippingAddress: o.shippingAddress,
  estimatedDelivery: toDateOnly(o.estimatedDelivery),
  items: o.items.map((i) => ({
    id: i.id,
    bookId: i.bookId,
    bookTitle: i.bookTitle,
    bookAuthor: i.bookAuthor,
    bookFormat: i.bookFormat,
    coverImageUrl: i.coverImageUrl,
    unitPrice: num(i.unitPrice),
    quantity: i.quantity,
    totalPrice: num(i.totalPrice),
  })),
  statusHistory: o.history.map((h) => ({ status: h.status, comments: h.comments, createdAt: h.createdAt })),
  payment: o.payments[0] ? toPaymentView(o.payments[0]) : undefined,
  shipment: o.shipment ? shippingService.toTracking(o.shipment) : undefined,
  createdAt: o.createdAt,
});

async function loadFull(orderId: string, db: TxClient | typeof prisma = prisma): Promise<FullOrder> {
  const o = await db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!o) throw notFound('Order not found');
  return o;
}

async function loadOwned(userId: string, orderId: string): Promise<FullOrder> {
  const o = await loadFull(orderId);
  if (o.userId !== userId) throw forbidden('This order belongs to another customer');
  return o;
}

export const orderService = {
  async checkoutSummary(owner: CartOwner, input: CheckoutSummaryInput) {
    const p = await computePricing(owner, input);
    return {
      itemCount: p.itemCount,
      subtotal: p.subtotal,
      taxAmount: p.taxAmount,
      shippingFee: p.shippingFee,
      discountAmount: p.couponDiscount,
      pointsRedeemed: p.pointsRedeemed,
      pointsDiscount: p.pointsDiscount,
      totalAmount: p.totalAmount,
      couponCode: p.couponCode,
      estimatedDelivery: toDateOnly(p.estimatedDelivery),
    };
  },

  async validateCoupon(owner: CartOwner, code: string) {
    const cart = await cartService.resolveCart(owner);
    const subtotal = cartSubtotal(cart.items);
    const { coupon, discount } = await evaluateCoupon(code, subtotal);
    return { code: coupon.code, valid: true, discountAmount: discount, discountType: coupon.discountType };
  },

  /**
   * Idempotent on `idempotencyKey`: a replay returns the original order (created=false) and never
   * creates a second one. Everything else happens in one interactive transaction.
   */
  async createOrder(userId: string, idempotencyKey: string, input: CreateOrderInput) {
    const replay = async (): Promise<{ order: ReturnType<typeof toOrderView>; created: boolean } | null> => {
      const existing = await prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
      if (!existing) return null;
      if (existing.userId !== userId) throw new HttpError(409, 'Conflict', 'Idempotency-Key already used');
      return { order: toOrderView(existing), created: false };
    };
    const prior = await replay();
    if (prior) return prior;

    let address;
    if (input.addressId) {
      const saved = await prisma.address.findFirst({ where: { id: input.addressId, userId } });
      if (!saved) throw notFound('Address not found');
      address = {
        recipientName: saved.recipientName, phoneNumber: saved.phoneNumber, addressLine1: saved.addressLine1,
        addressLine2: saved.addressLine2, city: saved.city, state: saved.state, postalCode: saved.postalCode,
        country: saved.country, isDefault: saved.isDefault,
      };
    } else {
      address = input.shippingAddress!;
    }

    try {
      const orderId = await prisma.$transaction(async (tx) => {
        const pricing = await computePricing(
          { userId },
          { postalCode: address.postalCode, shippingTier: input.shippingTier, couponCode: input.couponCode, redeemPoints: input.redeemPoints },
          tx,
        );
        const discountAmount = pricing.couponDiscount + pricing.pointsDiscount;

        const order = await tx.order.create({
          data: {
            orderNumber: newOrderNumber(),
            userId,
            idempotencyKey,
            status: 'CREATED',
            subtotalAmount: pricing.subtotal,
            taxAmount: pricing.taxAmount,
            shippingFee: pricing.shippingFee,
            discountAmount,
            totalAmount: pricing.totalAmount,
            couponCode: pricing.couponCode,
            pointsRedeemed: pricing.pointsRedeemed,
            shippingAddress: address as unknown as Prisma.InputJsonValue,
            estimatedDelivery: pricing.estimatedDelivery,
            items: {
              create: pricing.lines.map((l) => ({
                bookId: l.bookId, bookTitle: l.title, bookAuthor: l.author, bookFormat: l.format,
                coverImageUrl: l.coverImageUrl, unitPrice: l.unitPrice, quantity: l.quantity, totalPrice: l.totalPrice,
              })),
            },
            history: { create: { status: 'CREATED', comments: 'Order placed' } },
          },
        });

        if (pricing.coupon) {
          // Conditional update guards the usage limit against concurrent redemptions.
          const lim = pricing.coupon.usageLimit;
          const res = await tx.coupon.updateMany({
            where: { id: pricing.coupon.id, ...(lim !== null ? { timesUsed: { lt: lim } } : {}) },
            data: { timesUsed: { increment: 1 } },
          });
          if (res.count === 0) throw unprocessable('Coupon usage limit reached');
        }
        if (pricing.pointsRedeemed > 0) {
          const res = await tx.user.updateMany({
            where: { id: userId, rewardPoints: { gte: pricing.pointsRedeemed } },
            data: { rewardPoints: { decrement: pricing.pointsRedeemed } },
          });
          if (res.count === 0) throw unprocessable('Insufficient reward points');
        }

        await transitionOrder(tx, order.id, 'PAYMENT_PENDING', 'Awaiting payment');
        await cartService.clearCart(pricing.cartId, tx);
        return order.id;
      });
      return { order: toOrderView(await loadFull(orderId)), created: true };
    } catch (e) {
      // Concurrent request with the same key won the race.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await replay();
        if (again) return again;
      }
      throw e;
    }
  },

  async listOrders(userId: string, q: OrderListQuery) {
    const where: Prisma.OrderWhereInput = { userId, ...(q.status ? { status: q.status } : {}) };
    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit,
      }),
    ]);
    return {
      data: rows.map(toOrderView),
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
    };
  },

  /** Customers see their own orders; fulfillment / store admins may view any (support use-case). */
  async getOrder(user: { id: string; roles: string[] }, orderId: string) {
    const staff = user.roles.some((r) => r === 'ROLE_FULFILLMENT' || r === 'ROLE_STORE_ADMIN');
    const o = staff ? await loadFull(orderId) : await loadOwned(user.id, orderId);
    return toOrderView(o);
  },

  /** Cancel before dispatch. Paid orders are refunded, stock / points / coupon usage are released. */
  async cancelOrder(userId: string, orderId: string, input: CancelOrderInput) {
    const reason = input.reason || 'Cancelled by customer';
    await loadOwned(userId, orderId);
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
      if (!CANCELLABLE.includes(order.status)) {
        throw unprocessable(`Order in status ${order.status} can no longer be cancelled`);
      }
      const paid = order.payments.find((p) => p.status === 'SUCCESS');
      if (paid) {
        await restoreStock(tx, orderId);
        await executeRefund(tx, paid, undefined, reason);
      }
      await tx.paymentTransaction.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'FAILED', errorMessage: 'Order cancelled' },
      });
      await releaseBenefits(tx, order);
      await transitionOrder(tx, orderId, 'CANCELLED', reason);
    });
    return toOrderView(await loadFull(orderId));
  },

  async requestReturn(userId: string, orderId: string, input: ReturnOrderInput) {
    const order = await loadOwned(userId, orderId);
    if (order.status !== 'DELIVERED') throw unprocessable('Only delivered orders can be returned');
    const deliveredAt = order.shipment?.deliveredAt;
    if (deliveredAt && Date.now() - deliveredAt.getTime() > RETURN_WINDOW_DAYS * 86400000) {
      throw unprocessable(`The ${RETURN_WINDOW_DAYS}-day return window has passed`);
    }
    await prisma.$transaction((tx) => transitionOrder(tx, orderId, 'RETURN_REQUESTED', input.reason));
    return toOrderView(await loadFull(orderId));
  },

  /** Fulfillment / admin progression: PROCESSING -> SHIPPED -> DELIVERED, and RETURN_REQUESTED -> RETURNED (+refund). */
  async updateStatus(orderId: string, input: UpdateStatusInput) {
    if (!STAFF_TARGETS.includes(input.status)) {
      throw unprocessable(`Status ${input.status} cannot be set manually`);
    }
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: true } });
      if (!order) throw notFound('Order not found');
      await transitionOrder(tx, orderId, input.status, input.comments);

      if (input.status === 'SHIPPED') {
        await shippingService.createShipment(tx, {
          orderId, carrierName: input.carrierName!, estimatedDelivery: order.estimatedDelivery,
        });
      } else if (input.status === 'DELIVERED') {
        await shippingService.markDelivered(tx, orderId);
      } else if (input.status === 'RETURNED') {
        await restoreStock(tx, orderId);
        const paid = order.payments.find((p) => p.status === 'SUCCESS');
        if (paid) {
          await executeRefund(tx, paid, undefined, 'Return accepted');
          await transitionOrder(tx, orderId, 'REFUNDED', 'Refund processed');
        }
      }
    });
    return toOrderView(await loadFull(orderId));
  },

  /** Re-adds a past order's items to the active cart (capped to available stock; out-of-stock lines skipped). */
  async buyAgain(userId: string, orderId: string) {
    const order = await loadOwned(userId, orderId);
    const cart = await cartService.resolveCart({ userId });
    let added = 0;
    for (const it of order.items) {
      const book = await prisma.book.findUnique({ where: { id: it.bookId } });
      if (!book || book.stockQuantity < 1) continue;
      const existing = cart.items.find((c) => c.bookId === it.bookId)?.quantity ?? 0;
      const qty = Math.min(it.quantity, book.stockQuantity - existing);
      if (qty < 1) continue;
      await cartService.addToCart(cart.id, it.bookId, qty);
      added += 1;
    }
    if (added === 0) throw unprocessable('None of the items from this order are currently available');
    return cartService.getCart({ userId });
  },
};

function cartSubtotal(items: Array<{ quantity: number; book: { price: Prisma.Decimal } }>): number {
  return Math.round(items.reduce((s, i) => s + num(i.book.price) * i.quantity, 0) * 100) / 100;
}

/** Give back reward points and coupon usage consumed at order creation. */
async function releaseBenefits(tx: TxClient, order: Order): Promise<void> {
  if (order.userId && order.pointsRedeemed > 0) {
    await tx.user.update({ where: { id: order.userId }, data: { rewardPoints: { increment: order.pointsRedeemed } } });
  }
  if (order.couponCode) {
    await tx.coupon.updateMany({
      where: { code: order.couponCode, timesUsed: { gt: 0 } },
      data: { timesUsed: { decrement: 1 } },
    });
  }
}

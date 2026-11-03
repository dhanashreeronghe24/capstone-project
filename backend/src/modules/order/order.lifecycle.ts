import { OrderStatus } from '@prisma/client';
import { TxClient } from '../../config/prisma.client';
import { conflict, notFound, unprocessable } from '../../utils/http-error';

/** FR-ORD-02 order state machine. Anything not listed is an illegal transition (422). */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: [],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

/** Moves an order to `to` and appends a history row; optimistic on the current status. */
export async function transitionOrder(
  tx: TxClient,
  orderId: string,
  to: OrderStatus,
  comments?: string,
): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Order not found');
  if (!ALLOWED_TRANSITIONS[order.status].includes(to)) {
    throw unprocessable(`Cannot move order from ${order.status} to ${to}`);
  }
  const res = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: to } });
  if (res.count === 0) throw conflict('Order was modified concurrently, please retry');
  await tx.orderStatusHistory.create({ data: { orderId, status: to, comments } });
}

/** Atomically deducts stock for every line of an order; throws 422 if any line is short. */
export async function deductStock(tx: TxClient, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    const res = await tx.book.updateMany({
      where: { id: it.bookId, stockQuantity: { gte: it.quantity } },
      data: { stockQuantity: { decrement: it.quantity }, totalSalesCount: { increment: it.quantity } },
    });
    if (res.count === 0) throw unprocessable(`Insufficient stock for "${it.bookTitle}"`);
  }
}

export async function restoreStock(tx: TxClient, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    await tx.book.update({
      where: { id: it.bookId },
      data: { stockQuantity: { increment: it.quantity }, totalSalesCount: { decrement: it.quantity } },
    });
  }
}

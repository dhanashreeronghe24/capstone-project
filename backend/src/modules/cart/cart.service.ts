import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.config';
import { prisma, TxClient } from '../../config/prisma.client';
import { notFound, unprocessable } from '../../utils/http-error';
import { num, round2 } from '../../utils/money';

const cartInclude = {
  items: { include: { book: { include: { author: true } } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CartInclude;
type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface CartOwner {
  userId?: string;
  guestSessionId?: string;
}

export const toCartView = (cart: CartWithItems) => {
  const items = cart.items.map((i) => {
    const unitPrice = num(i.book.price); // always reflect the live catalog price
    return {
      id: i.id,
      bookId: i.bookId,
      title: i.book.title,
      author: i.book.author.name,
      format: i.book.format,
      coverImageUrl: i.book.frontCoverUrl,
      unitPrice,
      quantity: i.quantity,
      lineTotal: round2(unitPrice * i.quantity),
    };
  });
  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const taxAmount = round2(subtotal * env.TAX_RATE);
  return {
    id: cart.id,
    guestSessionId: cart.sessionToken,
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotal,
    taxAmount,
    shippingFee: 0, // pincode-dependent; computed at checkout
    totalAmount: round2(subtotal + taxAmount),
  };
};

export const cartService = {
  /** Find or create the cart for a user or guest session (a guest session token is minted when absent). */
  async resolveCart(owner: CartOwner, db: TxClient | typeof prisma = prisma): Promise<CartWithItems> {
    if (owner.userId) {
      const existing = await db.cart.findUnique({ where: { userId: owner.userId }, include: cartInclude });
      return existing ?? db.cart.create({ data: { userId: owner.userId }, include: cartInclude });
    }
    const token = owner.guestSessionId ?? randomUUID();
    const existing = await db.cart.findUnique({ where: { sessionToken: token }, include: cartInclude });
    return existing ?? db.cart.create({ data: { sessionToken: token }, include: cartInclude });
  },

  async getCart(owner: CartOwner) {
    return toCartView(await this.resolveCart(owner));
  },

  /** Adds (or increments) a book in a cart, enforcing stock. Usable inside a caller's transaction. */
  async addToCart(cartId: string, bookId: string, quantity: number, db: TxClient | typeof prisma = prisma) {
    const book = await db.book.findUnique({ where: { id: bookId } });
    if (!book) throw notFound('Book not found');
    const existing = await db.cartItem.findUnique({ where: { cartId_bookId: { cartId, bookId } } });
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > book.stockQuantity) {
      throw unprocessable(`Only ${book.stockQuantity} unit(s) of "${book.title}" available`);
    }
    if (existing) {
      await db.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty, unitPrice: book.price } });
    } else {
      await db.cartItem.create({ data: { cartId, bookId, quantity: newQty, unitPrice: book.price } });
    }
  },

  async addItem(owner: CartOwner, bookId: string, quantity: number) {
    const cart = await this.resolveCart(owner);
    await this.addToCart(cart.id, bookId, quantity);
    return this.getCart(owner.userId ? owner : { guestSessionId: cart.sessionToken ?? undefined });
  },

  async updateItem(owner: CartOwner, itemId: string, quantity: number) {
    const cart = await this.resolveCart(owner);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw notFound('Cart item not found');
    if (quantity > item.book.stockQuantity) {
      throw unprocessable(`Only ${item.book.stockQuantity} unit(s) of "${item.book.title}" available`);
    }
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity, unitPrice: item.book.price } });
    return toCartView(await this.resolveCart(owner));
  },

  async removeItem(owner: CartOwner, itemId: string) {
    const cart = await this.resolveCart(owner);
    if (!cart.items.some((i) => i.id === itemId)) throw notFound('Cart item not found');
    await prisma.cartItem.delete({ where: { id: itemId } });
    return toCartView(await this.resolveCart(owner));
  },

  async clearCart(cartId: string, db: TxClient | typeof prisma = prisma): Promise<void> {
    await db.cartItem.deleteMany({ where: { cartId } });
  },

  /** Merges a guest cart into the customer's cart (quantities summed, capped at stock) and removes it. */
  async mergeGuestCart(userId: string, guestSessionId: string) {
    await prisma.$transaction(async (tx) => {
      const guest = await tx.cart.findUnique({
        where: { sessionToken: guestSessionId },
        include: { items: { include: { book: true } } },
      });
      if (!guest) return;
      const userCart = await this.resolveCart({ userId }, tx);
      for (const gi of guest.items) {
        const existing = await tx.cartItem.findUnique({
          where: { cartId_bookId: { cartId: userCart.id, bookId: gi.bookId } },
        });
        const qty = Math.min((existing?.quantity ?? 0) + gi.quantity, gi.book.stockQuantity);
        if (qty < 1) continue;
        if (existing) {
          await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: qty, unitPrice: gi.book.price } });
        } else {
          await tx.cartItem.create({
            data: { cartId: userCart.id, bookId: gi.bookId, quantity: qty, unitPrice: gi.book.price },
          });
        }
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
    return this.getCart({ userId });
  },
};

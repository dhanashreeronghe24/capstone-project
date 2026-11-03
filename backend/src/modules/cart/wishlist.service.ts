import { prisma } from '../../config/prisma.client';
import { conflict, notFound } from '../../utils/http-error';
import { toBookSummary } from '../catalog/catalog.service';
import { cartService } from './cart.service';

const include = { book: { include: { author: true, categories: { include: { category: true } } } } };

const toView = (w: { id: string; createdAt: Date; book: Parameters<typeof toBookSummary>[0] }) => ({
  id: w.id,
  book: toBookSummary(w.book),
  createdAt: w.createdAt,
});

export const wishlistService = {
  async list(userId: string) {
    const rows = await prisma.wishlistItem.findMany({ where: { userId }, include, orderBy: { createdAt: 'desc' } });
    return rows.map(toView);
  },

  async add(userId: string, bookId: string) {
    if (!(await prisma.book.findUnique({ where: { id: bookId } }))) throw notFound('Book not found');
    if (await prisma.wishlistItem.findUnique({ where: { userId_bookId: { userId, bookId } } })) {
      throw conflict('Book is already in the wishlist');
    }
    return toView(await prisma.wishlistItem.create({ data: { userId, bookId }, include }));
  },

  async remove(userId: string, bookId: string): Promise<void> {
    const res = await prisma.wishlistItem.deleteMany({ where: { userId, bookId } });
    if (res.count === 0) throw notFound('Book not in wishlist');
  },

  /** Atomically moves a wishlist entry into the customer's cart. */
  async moveToCart(userId: string, bookId: string) {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.wishlistItem.findUnique({ where: { userId_bookId: { userId, bookId } } });
      if (!entry) throw notFound('Book not in wishlist');
      const cart = await cartService.resolveCart({ userId }, tx);
      await cartService.addToCart(cart.id, bookId, 1, tx);
      await tx.wishlistItem.delete({ where: { id: entry.id } });
    });
    return cartService.getCart({ userId });
  },
};

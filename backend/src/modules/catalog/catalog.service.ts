import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.client';
import { conflict, notFound } from '../../utils/http-error';
import { num, numOrNull, toDateOnly } from '../../utils/money';
import {
  BookQuery,
  CreateBookInput,
  PageQuery,
  ReviewInput,
  UpdateBookInput,
} from './catalog.schema';

const summaryInclude = {
  author: true,
  categories: { include: { category: true } },
} satisfies Prisma.BookInclude;

const detailInclude = {
  ...summaryInclude,
  publisher: true,
} satisfies Prisma.BookInclude;

type SummaryBook = Prisma.BookGetPayload<{ include: typeof summaryInclude }>;
type DetailBook = Prisma.BookGetPayload<{ include: typeof detailInclude }>;

export const toBookSummary = (b: SummaryBook) => ({
  id: b.id,
  title: b.title,
  subtitle: b.subtitle,
  author: { id: b.author.id, name: b.author.name },
  format: b.format,
  language: b.language,
  price: num(b.price),
  listPrice: numOrNull(b.listPrice),
  frontCoverUrl: b.frontCoverUrl,
  averageRating: num(b.averageRating),
  reviewCount: b.reviewCount,
  inStock: b.stockQuantity > 0,
  categories: b.categories.map((c) => ({ id: Number(c.category.id), name: c.category.name, slug: c.category.slug })),
});

const toBookDetail = (b: DetailBook) => ({
  ...toBookSummary(b),
  isbn: b.isbn,
  description: b.description,
  backCoverUrl: b.backCoverUrl,
  publisher: b.publisher
    ? { id: b.publisher.id, name: b.publisher.name, description: b.publisher.description }
    : null,
  authorBio: b.author.bio,
  stockQuantity: b.stockQuantity,
  totalSalesCount: b.totalSalesCount,
  publicationDate: b.publicationDate ? toDateOnly(b.publicationDate) : null,
});

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

function buildOrderBy(sort: BookQuery['sort']): Prisma.BookOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }];
    case 'publication_date':
      return [{ publicationDate: { sort: 'desc', nulls: 'last' } }];
    case 'rating':
      return [{ averageRating: 'desc' }, { reviewCount: 'desc' }];
    default:
      return [{ totalSalesCount: 'desc' }, { averageRating: 'desc' }];
  }
}

export const catalogService = {
  async listCategories() {
    const rows = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    interface Node { id: number; name: string; slug: string; children: Node[] }
    const nodes = new Map<string, Node>(
      rows.map((r) => [r.id.toString(), { id: Number(r.id), name: r.name, slug: r.slug, children: [] }]),
    );
    const roots: Node[] = [];
    for (const r of rows) {
      const node = nodes.get(r.id.toString())!;
      const parent = r.parentId !== null ? nodes.get(r.parentId.toString()) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  },

  async searchBooks(q: BookQuery) {
    const and: Prisma.BookWhereInput[] = [];
    if (q.q) {
      and.push({
        OR: [
          { title: { contains: q.q, mode: 'insensitive' } },
          { author: { name: { contains: q.q, mode: 'insensitive' } } },
          { publisher: { name: { contains: q.q, mode: 'insensitive' } } },
        ],
      });
    }
    if (q.category) {
      // include books in child categories of the requested category
      and.push({
        categories: {
          some: { category: { OR: [{ slug: q.category }, { parent: { slug: q.category } }] } },
        },
      });
    }
    if (q.authorId) and.push({ authorId: q.authorId });
    if (q.publisher) and.push({ publisher: { name: { contains: q.publisher, mode: 'insensitive' } } });
    if (q.format) and.push({ format: q.format });
    if (q.language) and.push({ language: { equals: q.language, mode: 'insensitive' } });
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      and.push({ price: { gte: q.minPrice, lte: q.maxPrice } });
    }
    const where: Prisma.BookWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        include: summaryInclude,
        orderBy: buildOrderBy(q.sort),
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { data: rows.map(toBookSummary), pagination: pagination(q.page, q.limit, total) };
  },

  async getBook(id: string) {
    const book = await prisma.book.findUnique({ where: { id }, include: detailInclude });
    if (!book) throw notFound('Book not found');
    return toBookDetail(book);
  },

  async getFeatured() {
    const take = 6;
    const [recommended, bestsellers, newLaunches] = await Promise.all([
      prisma.book.findMany({
        where: { isFeatured: true },
        include: summaryInclude,
        orderBy: [{ averageRating: 'desc' }, { totalSalesCount: 'desc' }],
        take,
      }),
      prisma.book.findMany({
        where: { isBestseller: true },
        include: summaryInclude,
        orderBy: { totalSalesCount: 'desc' },
        take,
      }),
      prisma.book.findMany({
        where: { isNewLaunch: true },
        include: summaryInclude,
        orderBy: [{ publicationDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take,
      }),
    ]);
    return {
      recommended: recommended.map(toBookSummary),
      bestsellers: bestsellers.map(toBookSummary),
      newLaunches: newLaunches.map(toBookSummary),
    };
  },

  /** Deterministic related reads: shared categories first, then same author, ranked by sales. */
  async getRelated(id: string) {
    const book = await prisma.book.findUnique({ where: { id }, include: { categories: true } });
    if (!book) throw notFound('Book not found');
    const categoryIds = book.categories.map((c) => c.categoryId);
    const rows = await prisma.book.findMany({
      where: {
        id: { not: id },
        OR: [{ categories: { some: { categoryId: { in: categoryIds } } } }, { authorId: book.authorId }],
      },
      include: summaryInclude,
      orderBy: [{ totalSalesCount: 'desc' }, { averageRating: 'desc' }],
      take: 6,
    });
    return rows.map(toBookSummary);
  },

  async getAuthor(id: string) {
    const author = await prisma.author.findUnique({
      where: { id },
      include: { books: { include: summaryInclude, orderBy: { totalSalesCount: 'desc' } } },
    });
    if (!author) throw notFound('Author not found');
    return {
      id: author.id,
      name: author.name,
      bio: author.bio,
      avatarUrl: author.avatarUrl,
      books: author.books.map(toBookSummary),
    };
  },

  async createBook(input: CreateBookInput) {
    const author = await prisma.author.findUnique({ where: { id: input.authorId } });
    if (!author) throw notFound('Author not found');
    if (await prisma.book.findUnique({ where: { isbn: input.isbn } })) throw conflict('ISBN already exists');
    const { categoryIds, publicationDate, ...rest } = input;
    const created = await prisma.book.create({
      data: {
        ...rest,
        publicationDate: publicationDate ? new Date(publicationDate) : undefined,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
      include: detailInclude,
    });
    return toBookDetail(created);
  },

  async updateBook(id: string, input: UpdateBookInput) {
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) throw notFound('Book not found');
    const { categoryIds, publicationDate, ...rest } = input;
    const updated = await prisma.$transaction(async (tx) => {
      if (categoryIds) {
        await tx.bookCategory.deleteMany({ where: { bookId: id } });
        await tx.bookCategory.createMany({ data: categoryIds.map((categoryId) => ({ bookId: id, categoryId })) });
      }
      return tx.book.update({
        where: { id },
        data: {
          ...rest,
          ...(publicationDate !== undefined
            ? { publicationDate: publicationDate ? new Date(publicationDate) : null }
            : {}),
        },
        include: detailInclude,
      });
    });
    return toBookDetail(updated);
  },

  async listReviews(bookId: string, p: PageQuery) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw notFound('Book not found');
    const [total, rows] = await Promise.all([
      prisma.review.count({ where: { bookId } }),
      prisma.review.findMany({
        where: { bookId },
        orderBy: { createdAt: 'desc' },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        bookId: r.bookId,
        rating: r.rating,
        reviewerName: r.reviewerName,
        comment: r.comment,
        isVerifiedPurchase: r.isVerifiedPurchase,
        createdAt: r.createdAt,
      })),
      pagination: pagination(p.page, p.limit, total),
      averageRating: num(book.averageRating),
      reviewCount: book.reviewCount,
    };
  },

  /** Creates the review and recomputes the book's aggregated rating atomically. */
  async createReview(bookId: string, userId: string, input: ReviewInput) {
    const [book, user] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    if (!book) throw notFound('Book not found');
    if (await prisma.review.findUnique({ where: { bookId_userId: { bookId, userId } } })) {
      throw conflict('You have already reviewed this book');
    }
    const purchased = await prisma.orderItem.count({
      where: {
        bookId,
        order: { userId, status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      },
    });

    return prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          bookId,
          userId,
          rating: input.rating,
          comment: input.comment,
          reviewerName: `${user.firstName} ${user.lastName}`.trim(),
          isVerifiedPurchase: purchased > 0,
        },
      });
      const agg = await tx.review.aggregate({
        where: { bookId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.book.update({
        where: { id: bookId },
        data: {
          averageRating: Math.round((agg._avg.rating ?? 0) * 100) / 100,
          reviewCount: agg._count._all,
        },
      });
      return {
        id: review.id,
        bookId: review.bookId,
        rating: review.rating,
        reviewerName: review.reviewerName,
        comment: review.comment,
        isVerifiedPurchase: review.isVerifiedPurchase,
        createdAt: review.createdAt,
      };
    });
  },
};

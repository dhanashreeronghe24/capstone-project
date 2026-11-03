import bcrypt from 'bcryptjs';
import { BookFormat, DiscountType, PrismaClient, ShippingTier, ZoneCode } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = [
  ['ROLE_CUSTOMER', 'Registered customer'],
  ['ROLE_CATALOG_ADMIN', 'Catalog manager'],
  ['ROLE_STORE_ADMIN', 'Store operations / admin'],
  ['ROLE_FULFILLMENT', 'Fulfillment / support specialist'],
  ['ROLE_SYSTEM', 'System / automated worker'],
] as const;

const CATEGORIES = [
  'Romance', 'Mystery', 'Science Fiction', 'Fantasy', 'Historical', 'Biography', 'Self-Help',
  'Memoir', 'Travel', 'Cooking', "Children's", 'Young Adult', 'Combics & Graphic Novels',
  'Poetry', 'Drama', 'Science', 'Philosophy', 'Religion', 'Language Learning',
  'Fiction', 'Non-Fiction', 'Thriller', 'Adventure',
];
const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

interface SeedBook {
  title: string; author: string; isbn: string; format: BookFormat; price: number; listPrice?: number;
  description: string; cats: string[]; stock: number; sales: number; rating: number; reviews: number;
  featured?: boolean; bestseller?: boolean; newLaunch?: boolean; published: string;
}

const BOOKS: SeedBook[] = [
  { title: 'The Art of Focus', author: 'Arjun Patel', isbn: '9780000000011', format: 'PAPERBACK', price: 399, listPrice: 499,
    description: 'Practical guide to mastering focus & thriving in the modern everyday way.', cats: ['Non-Fiction', 'Self-Help'],
    stock: 50, sales: 120, rating: 4.4, reviews: 38, featured: true, published: '2024-02-10' },
  { title: 'The Art of Learning', author: 'Raj Patel', isbn: '9780000000028', format: 'PAPERBACK', price: 259,
    description: 'Master the mindset and methods for lifelong learning.', cats: ['Non-Fiction', 'Self-Help'],
    stock: 40, sales: 80, rating: 4.2, reviews: 21, featured: true, published: '2023-11-01' },
  { title: 'The Path to Success', author: 'James Wright', isbn: '9780000000035', format: 'PAPERBACK', price: 359,
    description: 'A practical guide to achieving goals with clarity and confidence.', cats: ['Non-Fiction', 'Self-Help'],
    stock: 60, sales: 150, rating: 4.6, reviews: 52, featured: true, published: '2024-01-15' },
  { title: 'The Midnight Hour', author: 'James Adams', isbn: '9780000000042', format: 'PAPERBACK', price: 299,
    description: 'Haunting tale of a man’s journey & the shadows of a quiet town.', cats: ['Fiction', 'Thriller', 'Mystery'],
    stock: 35, sales: 300, rating: 4.5, reviews: 90, bestseller: true, published: '2023-06-20' },
  { title: 'Beneath the Stars', author: 'Jessica Martin', isbn: '9780000000059', format: 'HARDCOVER', price: 499,
    description: 'A heartwarming story of love under a night sky.', cats: ['Fiction', 'Romance'],
    stock: 25, sales: 280, rating: 4.7, reviews: 77, bestseller: true, published: '2023-09-12' },
  { title: 'The Final Frontier', author: 'Laura Mitchell', isbn: '9780000000066', format: 'PAPERBACK', price: 359,
    description: 'A mission to space and the courage to change humanity forever.', cats: ['Fiction', 'Science Fiction', 'Adventure'],
    stock: 45, sales: 260, rating: 4.3, reviews: 64, bestseller: true, published: '2023-12-05' },
  { title: 'Joy of Minimalism', author: 'Daniel Reed', isbn: '9780000000073', format: 'PAPERBACK', price: 149, listPrice: 199,
    description: 'Declutter your life to uncover peace, clarity, and joy.', cats: ['Non-Fiction', 'Self-Help'],
    stock: 100, sales: 20, rating: 4.1, reviews: 9, newLaunch: true, published: '2026-09-01' },
  { title: 'The Vanishing House', author: 'Clara Nelson', isbn: '9780000000080', format: 'EBOOK', price: 99,
    description: 'A chilling mystery within a house that disappears.', cats: ['Fiction', 'Mystery'],
    stock: 999, sales: 15, rating: 4.0, reviews: 6, newLaunch: true, published: '2026-09-10' },
  { title: 'The Lost Kitten', author: 'Emily Rose', isbn: '9780000000097', format: 'HARDCOVER', price: 339,
    description: 'A heartwarming tale of courage, friendship, and home adventure.', cats: ["Children's", 'Fiction'],
    stock: 30, sales: 12, rating: 4.8, reviews: 11, newLaunch: true, published: '2026-09-20' },
];

const PINCODES: Array<[string, string, string, ZoneCode, number, number]> = [
  ['560001', 'Bengaluru', 'Karnataka', 'LOCAL', 2, 1],
  ['560100', 'Bengaluru', 'Karnataka', 'LOCAL', 2, 1],
  ['600001', 'Chennai', 'Tamil Nadu', 'REGIONAL', 3, 1],
  ['400001', 'Mumbai', 'Maharashtra', 'METRO', 3, 1],
  ['110001', 'New Delhi', 'Delhi', 'METRO', 3, 1],
  ['700001', 'Kolkata', 'West Bengal', 'METRO', 4, 2],
  ['500001', 'Hyderabad', 'Telangana', 'REGIONAL', 3, 1],
  ['380001', 'Ahmedabad', 'Gujarat', 'NATIONAL', 5, 2],
  ['795001', 'Imphal', 'Manipur', 'NATIONAL', 8, 4],
];

async function main(): Promise<void> {
  for (const [name, description] of ROLES) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name, description } });
  }

  const users: Array<[string, string, string, Array<(typeof ROLES)[number][0]>]> = [
    ['customer@bookworm.test', 'Demo', 'Customer', ['ROLE_CUSTOMER']],
    ['catalog@bookworm.test', 'Cat', 'Admin', ['ROLE_CATALOG_ADMIN']],
    ['admin@bookworm.test', 'Store', 'Admin', ['ROLE_STORE_ADMIN']],
    ['fulfillment@bookworm.test', 'Fulfil', 'Agent', ['ROLE_FULFILLMENT']],
  ];
  const passwordHash = await bcrypt.hash('Password@123', 10);
  for (const [email, firstName, lastName, roleNames] of users) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, firstName, lastName, passwordHash, rewardPoints: email.startsWith('customer') ? 200 : 0 },
    });
    for (const rn of roleNames) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: rn } });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
  }

  const catIds = new Map<string, bigint>();
  for (const [i, name] of CATEGORIES.entries()) {
    const c = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name), displayOrder: i },
    });
    catIds.set(name, c.id);
  }
  // Simple two-level taxonomy: genres under Fiction / Non-Fiction
  const fiction = catIds.get('Fiction')!;
  const nonFiction = catIds.get('Non-Fiction')!;
  for (const n of ['Romance', 'Mystery', 'Science Fiction', 'Fantasy', 'Thriller', 'Adventure', 'Historical']) {
    await prisma.category.update({ where: { id: catIds.get(n)! }, data: { parentId: fiction } });
  }
  for (const n of ['Biography', 'Self-Help', 'Memoir', 'Travel', 'Cooking', 'Science', 'Philosophy']) {
    await prisma.category.update({ where: { id: catIds.get(n)! }, data: { parentId: nonFiction } });
  }

  const publisher = await prisma.publisher.upsert({
    where: { name: 'BookWorm Press' },
    update: {},
    create: { name: 'BookWorm Press', description: 'In-house publishing imprint' },
  });

  for (const b of BOOKS) {
    let author = await prisma.author.findFirst({ where: { name: b.author } });
    if (!author) {
      author = await prisma.author.create({
        data: { name: b.author, bio: `${b.author} is an acclaimed author of popular bestsellers.` },
      });
    }
    const data = {
      title: b.title, isbn: b.isbn, authorId: author.id, publisherId: publisher.id, format: b.format,
      description: b.description,
      // Served by the frontend (frontend/public/covers, generated by frontend/scripts/generate-covers.mjs)
      frontCoverUrl: `/covers/${slugify(b.title)}-front.svg`,
      backCoverUrl: `/covers/${slugify(b.title)}-back.svg`,
      price: b.price, listPrice: b.listPrice, stockQuantity: b.stock, totalSalesCount: b.sales,
      averageRating: b.rating, reviewCount: b.reviews,
      isFeatured: b.featured ?? false, isBestseller: b.bestseller ?? false, isNewLaunch: b.newLaunch ?? false,
      publicationDate: new Date(b.published),
    };
    const book = await prisma.book.upsert({ where: { isbn: b.isbn }, update: data, create: data });
    for (const cn of b.cats) {
      await prisma.bookCategory.upsert({
        where: { bookId_categoryId: { bookId: book.id, categoryId: catIds.get(cn)! } },
        update: {},
        create: { bookId: book.id, categoryId: catIds.get(cn)! },
      });
    }
  }

  const now = new Date();
  const nextYear = new Date(now.getTime() + 365 * 86400000);
  const coupons: Array<{ code: string; type: DiscountType; value: number; min: number; max?: number }> = [
    { code: 'WELCOME10', type: 'PERCENTAGE', value: 10, min: 200, max: 100 },
    { code: 'FLAT50', type: 'FIXED_AMOUNT', value: 50, min: 300 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code, discountType: c.type, discountValue: c.value, minOrderAmount: c.min,
        maxDiscountAmount: c.max, validFrom: new Date(now.getTime() - 86400000), validUntil: nextYear,
      },
    });
  }

  for (const [postalPincode, city, state, zoneCode, standardEddDays, expressEddDays] of PINCODES) {
    await prisma.pincodeZone.upsert({
      where: { postalPincode },
      update: {},
      create: { postalPincode, city, state, zoneCode, standardEddDays, expressEddDays },
    });
  }

  const rates: Array<[ZoneCode, ShippingTier, number, number]> = [
    ['LOCAL', 'STANDARD', 40, 5], ['LOCAL', 'EXPRESS', 90, 10],
    ['REGIONAL', 'STANDARD', 60, 8], ['REGIONAL', 'EXPRESS', 120, 15],
    ['METRO', 'STANDARD', 60, 8], ['METRO', 'EXPRESS', 120, 15],
    ['NATIONAL', 'STANDARD', 80, 12], ['NATIONAL', 'EXPRESS', 160, 20],
  ];
  for (const [zoneCode, shippingTier, baseRate, perKgRate] of rates) {
    await prisma.shippingRate.upsert({
      where: { zoneCode_shippingTier: { zoneCode, shippingTier } },
      update: {},
      create: { zoneCode, shippingTier, baseRate, perKgRate, freeShippingThreshold: 499 },
    });
  }

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

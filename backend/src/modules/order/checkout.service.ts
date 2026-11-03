import { Coupon, ShippingTier } from '@prisma/client';
import { env } from '../../config/env.config';
import { prisma, TxClient } from '../../config/prisma.client';
import { notFound, unprocessable } from '../../utils/http-error';
import { num, round2 } from '../../utils/money';
import { CartOwner, cartService } from '../cart/cart.service';
import { BOOK_WEIGHT_KG, shippingService } from '../shipping/shipping.service';

type Db = TxClient | typeof prisma;

export interface PricingInput {
  postalCode: string;
  shippingTier: ShippingTier;
  couponCode?: string;
  redeemPoints: number;
}

export interface PricedLine {
  bookId: string;
  title: string;
  author: string;
  format: string;
  coverImageUrl: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface Pricing {
  cartId: string;
  lines: PricedLine[];
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  couponDiscount: number;
  couponCode: string | null;
  coupon: Coupon | null;
  pointsRedeemed: number;
  pointsDiscount: number;
  totalAmount: number;
  estimatedDelivery: Date;
}

/** Validates a coupon against an order subtotal and returns the discount it would grant. */
export async function evaluateCoupon(
  code: string,
  subtotal: number,
  db: Db = prisma,
): Promise<{ coupon: Coupon; discount: number }> {
  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon) throw notFound(`Coupon "${code}" does not exist`);
  const now = new Date();
  if (!coupon.isActive) throw unprocessable('Coupon is not active');
  if (now < coupon.validFrom) throw unprocessable('Coupon is not valid yet');
  if (now > coupon.validUntil) throw unprocessable('Coupon has expired');
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) {
    throw unprocessable('Coupon usage limit reached');
  }
  if (subtotal < num(coupon.minOrderAmount)) {
    throw unprocessable(`Minimum order value for this coupon is ${num(coupon.minOrderAmount).toFixed(2)}`);
  }
  let discount =
    coupon.discountType === 'PERCENTAGE' ? (subtotal * num(coupon.discountValue)) / 100 : num(coupon.discountValue);
  if (coupon.maxDiscountAmount !== null) discount = Math.min(discount, num(coupon.maxDiscountAmount));
  return { coupon, discount: round2(Math.min(discount, subtotal)) };
}

/** Single source of truth for checkout maths, shared by the summary preview and order creation. */
export async function computePricing(owner: CartOwner, input: PricingInput, db: Db = prisma): Promise<Pricing> {
  if (!owner.userId && !owner.guestSessionId) throw unprocessable('Cart is empty');
  const cart = await cartService.resolveCart(owner, db);
  if (cart.items.length === 0) throw unprocessable('Cart is empty');

  const lines: PricedLine[] = cart.items.map((i) => {
    if (i.quantity > i.book.stockQuantity) {
      throw unprocessable(`Only ${i.book.stockQuantity} unit(s) of "${i.book.title}" available`);
    }
    const unitPrice = num(i.book.price);
    return {
      bookId: i.bookId,
      title: i.book.title,
      author: i.book.author.name,
      format: i.book.format,
      coverImageUrl: i.book.frontCoverUrl,
      unitPrice,
      quantity: i.quantity,
      totalPrice: round2(unitPrice * i.quantity),
    };
  });
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.totalPrice, 0));
  const taxAmount = round2(subtotal * env.TAX_RATE);

  const quote = await shippingService.quote(
    { postalCode: input.postalCode, weightKg: round2(itemCount * BOOK_WEIGHT_KG), orderAmount: subtotal, tier: input.shippingTier },
    db,
  );

  let coupon: Coupon | null = null;
  let couponDiscount = 0;
  if (input.couponCode) {
    const ev = await evaluateCoupon(input.couponCode, subtotal, db);
    coupon = ev.coupon;
    couponDiscount = ev.discount;
  }

  const payableBeforePoints = round2(subtotal + taxAmount + quote.rate - couponDiscount);
  let pointsRedeemed = 0;
  let pointsDiscount = 0;
  if (input.redeemPoints > 0) {
    if (!owner.userId) throw unprocessable('Login is required to redeem reward points');
    const user = await db.user.findUniqueOrThrow({ where: { id: owner.userId } });
    if (input.redeemPoints > user.rewardPoints) {
      throw unprocessable(`You only have ${user.rewardPoints} reward point(s)`);
    }
    // Never discount below zero: cap the points that can be spent.
    pointsRedeemed = Math.min(input.redeemPoints, Math.floor(payableBeforePoints / env.POINT_VALUE));
    pointsDiscount = round2(pointsRedeemed * env.POINT_VALUE);
  }

  return {
    cartId: cart.id,
    lines,
    itemCount,
    subtotal,
    taxAmount,
    shippingFee: quote.rate,
    couponDiscount,
    couponCode: coupon?.code ?? null,
    coupon,
    pointsRedeemed,
    pointsDiscount,
    totalAmount: round2(payableBeforePoints - pointsDiscount),
    estimatedDelivery: quote.estimatedDelivery,
  };
}

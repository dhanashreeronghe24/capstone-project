import { randomBytes } from 'crypto';
import { Shipment, ShippingTier, ZoneCode } from '@prisma/client';
import { prisma, TxClient } from '../../config/prisma.client';
import { notFound, unprocessable } from '../../utils/http-error';
import { addDays, num, round2, toDateOnly } from '../../utils/money';
import { CalculateRateInput, EstimateQuery } from './shipping.schema';

/** Catalog has no weight column; every book is priced for shipping at this average weight. */
export const BOOK_WEIGHT_KG = 0.4;

type Db = TxClient | typeof prisma;

export interface ShippingQuote {
  zoneCode: ZoneCode;
  tier: ShippingTier;
  rate: number;
  isFree: boolean;
  deliveryDays: number;
  estimatedDelivery: Date;
}

export const shippingService = {
  /** Rule-based quote: zone lookup by pincode, base + per-kg rate, free above the zone's threshold. */
  async quote(
    input: { postalCode: string; weightKg: number; orderAmount?: number; tier: ShippingTier },
    db: Db = prisma,
  ): Promise<ShippingQuote> {
    const zone = await db.pincodeZone.findUnique({ where: { postalPincode: input.postalCode } });
    if (!zone || !zone.isServicable) throw unprocessable(`Delivery is not available for pincode ${input.postalCode}`);
    const cfg = await db.shippingRate.findUnique({
      where: { zoneCode_shippingTier: { zoneCode: zone.zoneCode, shippingTier: input.tier } },
    });
    if (!cfg) throw unprocessable(`No ${input.tier} shipping rate configured for zone ${zone.zoneCode}`);

    const isFree = (input.orderAmount ?? 0) >= num(cfg.freeShippingThreshold);
    const rate = isFree ? 0 : round2(num(cfg.baseRate) + num(cfg.perKgRate) * input.weightKg);
    const deliveryDays = input.tier === 'STANDARD' ? zone.standardEddDays : zone.expressEddDays;
    return {
      zoneCode: zone.zoneCode,
      tier: input.tier,
      rate,
      isFree,
      deliveryDays,
      estimatedDelivery: addDays(new Date(), deliveryDays),
    };
  },

  async calculateRate(input: CalculateRateInput) {
    const q = await this.quote(input);
    return {
      zoneCode: q.zoneCode,
      tier: q.tier,
      rate: q.rate,
      isFree: q.isFree,
      estimatedDelivery: toDateOnly(q.estimatedDelivery),
    };
  },

  async estimateDelivery(query: EstimateQuery) {
    if (query.bookId && !(await prisma.book.findUnique({ where: { id: query.bookId } }))) {
      throw notFound('Book not found');
    }
    const zone = await prisma.pincodeZone.findUnique({ where: { postalPincode: query.postalCode } });
    if (!zone) throw notFound(`Pincode ${query.postalCode} not found`);
    if (!zone.isServicable) throw unprocessable(`Delivery is not available for pincode ${query.postalCode}`);
    const deliveryDays = query.tier === 'STANDARD' ? zone.standardEddDays : zone.expressEddDays;
    return {
      postalCode: query.postalCode,
      tier: query.tier,
      deliveryDays,
      estimatedDelivery: toDateOnly(addDays(new Date(), deliveryDays)),
      isServiceable: true,
    };
  },

  toTracking(s: Shipment) {
    const milestones = [{ status: 'MANIFESTED', timestamp: s.createdAt }];
    if (s.dispatchedAt) milestones.push({ status: 'IN_TRANSIT', timestamp: s.dispatchedAt });
    if (s.deliveredAt) milestones.push({ status: 'DELIVERED', timestamp: s.deliveredAt });
    return {
      trackingNumber: s.trackingNumber,
      carrierName: s.carrierName,
      shippingStatus: s.shippingStatus,
      dispatchedAt: s.dispatchedAt,
      estimatedDelivery: toDateOnly(s.estimatedDelivery),
      deliveredAt: s.deliveredAt,
      milestones,
    };
  },

  async track(trackingNumber: string) {
    const s = await prisma.shipment.findUnique({ where: { trackingNumber } });
    if (!s) throw notFound('Shipment not found');
    return this.toTracking(s);
  },

  /** Called by the order module when an order is dispatched. */
  async createShipment(
    tx: TxClient,
    input: { orderId: string; carrierName: string; estimatedDelivery: Date },
  ): Promise<Shipment> {
    return tx.shipment.create({
      data: {
        orderId: input.orderId,
        carrierName: input.carrierName,
        trackingNumber: `BW${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`,
        shippingStatus: 'IN_TRANSIT',
        dispatchedAt: new Date(),
        estimatedDelivery: input.estimatedDelivery,
      },
    });
  },

  async markDelivered(tx: TxClient, orderId: string): Promise<void> {
    await tx.shipment.updateMany({
      where: { orderId },
      data: { shippingStatus: 'DELIVERED', deliveredAt: new Date() },
    });
  },
};

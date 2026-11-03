import { Request, Response } from 'express';
import { CartOwner } from '../cart/cart.service';
import { orderService } from './order.service';
import {
  CancelOrderInput,
  CheckoutSummaryInput,
  CreateOrderInput,
  OrderListQuery,
  ReturnOrderInput,
  UpdateStatusInput,
  ValidateCouponInput,
} from './order.schema';

const ownerOf = (req: Request): CartOwner =>
  req.user ? { userId: req.user.id } : { guestSessionId: req.header('x-guest-session-id') || undefined };

export const orderController = {
  async checkoutSummary(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.checkoutSummary(ownerOf(req), req.body as CheckoutSummaryInput));
  },
  async create(req: Request, res: Response): Promise<void> {
    const key = req.header('idempotency-key')!;
    const { order, created } = await orderService.createOrder(req.user!.id, key, req.body as CreateOrderInput);
    res.status(created ? 201 : 200).json(order);
  },
  async list(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.listOrders(req.user!.id, req.query as unknown as OrderListQuery));
  },
  async get(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.getOrder(req.user!, req.params.orderId));
  },
  async cancel(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.cancelOrder(req.user!.id, req.params.orderId, req.body as CancelOrderInput));
  },
  async returnOrder(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.requestReturn(req.user!.id, req.params.orderId, req.body as ReturnOrderInput));
  },
  async updateStatus(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.updateStatus(req.params.orderId, req.body as UpdateStatusInput));
  },
  async buyAgain(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.buyAgain(req.user!.id, req.params.orderId));
  },
  async validateCoupon(req: Request, res: Response): Promise<void> {
    res.status(200).json(await orderService.validateCoupon(ownerOf(req), (req.body as ValidateCouponInput).code));
  },
};

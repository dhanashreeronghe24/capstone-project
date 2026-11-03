import { Request, Response } from 'express';
import { ConfirmPaymentInput, InitiatePaymentInput, RefundInput, WebhookInput } from './payment.schema';
import { paymentService } from './payment.service';

export const paymentController = {
  async initiate(req: Request, res: Response): Promise<void> {
    res.status(201).json(await paymentService.initiate(req.user!.id, req.body as InitiatePaymentInput));
  },
  async confirm(req: Request, res: Response): Promise<void> {
    res.status(200).json(await paymentService.confirm(req.user!.id, req.body as ConfirmPaymentInput));
  },
  async simulateWebhook(req: Request, res: Response): Promise<void> {
    res.status(200).json(await paymentService.handleWebhook(req.body as WebhookInput));
  },
  async refund(req: Request, res: Response): Promise<void> {
    res.status(201).json(await paymentService.refund(req.params.paymentId, req.body as RefundInput));
  },
};

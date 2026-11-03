import { Request, Response } from 'express';
import { CalculateRateInput, EstimateQuery } from './shipping.schema';
import { shippingService } from './shipping.service';

export const shippingController = {
  async calculateRate(req: Request, res: Response): Promise<void> {
    res.status(200).json(await shippingService.calculateRate(req.body as CalculateRateInput));
  },
  async estimateDelivery(req: Request, res: Response): Promise<void> {
    res.status(200).json(await shippingService.estimateDelivery(req.query as unknown as EstimateQuery));
  },
  async track(req: Request, res: Response): Promise<void> {
    res.status(200).json(await shippingService.track(req.params.trackingNumber));
  },
};

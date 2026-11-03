import { PaymentMethod } from '@prisma/client';

export interface PaymentInstrument {
  card?: { number: string; holderName: string; cvv: string; expiry: string };
  upiId?: string;
  walletId?: string;
}

export interface InitiatePaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
}

export interface InitiatePaymentResult {
  gatewayOrderId: string;
}

export interface VerifyPaymentRequest {
  gatewayOrderId: string;
  method: PaymentMethod;
  instrument: PaymentInstrument;
}

/** Outcome of a verification. `raw` is persisted for audit and must never contain PAN / CVV. */
export interface VerifyPaymentResult {
  status: 'SUCCESS' | 'FAILED';
  gatewayPaymentId?: string;
  errorMessage?: string;
  raw: Record<string, unknown>;
}

export interface RefundRequest {
  gatewayPaymentId: string;
  amount: number;
  reason: string;
}

export interface RefundResult {
  status: 'PROCESSED' | 'FAILED';
  gatewayRefundId?: string;
  raw: Record<string, unknown>;
}

/** Port implemented by every payment gateway (mock today; Stripe / Razorpay later). */
export interface PaymentGatewayAdapter {
  initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult>;
  verifyPayment(req: VerifyPaymentRequest): Promise<VerifyPaymentResult>;
  /** Interpret an asynchronous gateway callback. */
  processWebhook(payload: { gatewayOrderId: string; status: 'SUCCESS' | 'FAILED' }): Promise<VerifyPaymentResult>;
  processRefund(req: RefundRequest): Promise<RefundResult>;
}

import { randomUUID } from 'crypto';
import {
  InitiatePaymentRequest,
  InitiatePaymentResult,
  PaymentGatewayAdapter,
  RefundRequest,
  RefundResult,
  VerifyPaymentRequest,
  VerifyPaymentResult,
} from './payment-gateway.interface';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic in-process gateway. No network I/O.
 *   card ending 0000            -> FAILED  (declined)
 *   card ending 9999            -> FAILED  (insufficient funds)
 *   expired card expiry         -> FAILED  (card expired)
 *   UPI id starting with "fail" -> FAILED  (UPI declined)
 *   anything else               -> SUCCESS with MOCK_TXN_<uuid>
 * Refunds always succeed with MOCK_REF_<uuid>.
 */
export class MockPaymentGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly latencyMs = 0) {}

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) await sleep(this.latencyMs);
  }

  async initiatePayment(_req: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    await this.delay();
    return { gatewayOrderId: `MOCK_ORD_${randomUUID()}` };
  }

  async verifyPayment(req: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    await this.delay();
    const failure = this.detectFailure(req);
    if (failure) {
      return {
        status: 'FAILED',
        errorMessage: failure,
        raw: { gateway: 'MOCK', gatewayOrderId: req.gatewayOrderId, method: req.method, result: 'DECLINED', reason: failure, ...this.mask(req) },
      };
    }
    const gatewayPaymentId = `MOCK_TXN_${randomUUID()}`;
    return {
      status: 'SUCCESS',
      gatewayPaymentId,
      raw: { gateway: 'MOCK', gatewayOrderId: req.gatewayOrderId, method: req.method, result: 'SUCCESS', gatewayPaymentId, ...this.mask(req) },
    };
  }

  async processWebhook(payload: { gatewayOrderId: string; status: 'SUCCESS' | 'FAILED' }): Promise<VerifyPaymentResult> {
    await this.delay();
    if (payload.status === 'SUCCESS') {
      const gatewayPaymentId = `MOCK_TXN_${randomUUID()}`;
      return { status: 'SUCCESS', gatewayPaymentId, raw: { gateway: 'MOCK', source: 'WEBHOOK', ...payload, gatewayPaymentId } };
    }
    return {
      status: 'FAILED',
      errorMessage: 'Payment failed (webhook)',
      raw: { gateway: 'MOCK', source: 'WEBHOOK', ...payload },
    };
  }

  async processRefund(req: RefundRequest): Promise<RefundResult> {
    await this.delay();
    const gatewayRefundId = `MOCK_REF_${randomUUID()}`;
    return {
      status: 'PROCESSED',
      gatewayRefundId,
      raw: { gateway: 'MOCK', gatewayPaymentId: req.gatewayPaymentId, amount: req.amount, gatewayRefundId },
    };
  }

  private detectFailure({ instrument }: VerifyPaymentRequest): string | null {
    const { card, upiId } = instrument;
    if (card) {
      if (card.number.endsWith('0000')) return 'Card declined';
      if (card.number.endsWith('9999')) return 'Insufficient funds';
      const [mm, yy] = card.expiry.split('/').map(Number);
      const expiresAt = new Date(2000 + yy, mm, 1); // first day of the month after expiry
      if (expiresAt.getTime() <= Date.now()) return 'Card expired';
    }
    if (upiId && upiId.toLowerCase().startsWith('fail')) return 'UPI payment declined';
    return null;
  }

  /** Audit-safe instrument summary: never the PAN or CVV. */
  private mask({ instrument }: VerifyPaymentRequest): Record<string, string> {
    if (instrument.card) return { cardLast4: instrument.card.number.slice(-4) };
    if (instrument.upiId) return { upiId: instrument.upiId };
    if (instrument.walletId) return { walletId: instrument.walletId };
    return {};
  }
}

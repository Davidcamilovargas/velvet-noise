import { api } from "./api";

export interface CreatePaymentResult {
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  redirectUrl: string;
  customerEmail: string;
}

export async function createPayment(orderId: string): Promise<CreatePaymentResult> {
  const res = await api.post<{ data: CreatePaymentResult }>("/payments/create", { orderId });
  return res.data.data;
}

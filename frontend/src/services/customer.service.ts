import { api } from "./api";
import type { CustomerDetail, CustomerSummary } from "../types/api";

export async function fetchCustomers(search?: string): Promise<CustomerSummary[]> {
  const res = await api.get<{ data: CustomerSummary[] }>("/admin/customers", { params: { search } });
  return res.data.data;
}

export async function fetchCustomerById(id: string): Promise<CustomerDetail> {
  const res = await api.get<{ data: CustomerDetail }>(`/admin/customers/${id}`);
  return res.data.data;
}

export async function setCustomerStatus(id: string, isActive: boolean): Promise<CustomerDetail> {
  const res = await api.patch<{ data: CustomerDetail }>(`/admin/customers/${id}/status`, { isActive });
  return res.data.data;
}

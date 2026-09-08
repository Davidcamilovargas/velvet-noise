import { api } from "./api";
import type { Address } from "../types/api";

export interface AddressInput {
  label: string;
  department: string;
  city: string;
  addressLine: string;
  complement?: string;
  postalCode?: string;
  isDefault?: boolean;
}

async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}

export const listAddresses = () => unwrap<Address[]>(api.get("/addresses"));

export const createAddress = (input: AddressInput) => unwrap<Address>(api.post("/addresses", input));

export const updateAddress = (id: string, input: Partial<AddressInput>) =>
  unwrap<Address>(api.put(`/addresses/${id}`, input));

export const deleteAddress = (id: string) => api.delete(`/addresses/${id}`);

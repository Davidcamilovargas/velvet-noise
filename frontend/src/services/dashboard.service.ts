import { api } from "./api";
import type { DashboardSummary } from "../types/api";

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await api.get<{ data: DashboardSummary }>("/admin/dashboard");
  return res.data.data;
}

import { request } from "./auth.js";

export const adminApi = {
  customers: (query, signal) =>
    request(`/admin/customers?${new URLSearchParams(query)}`, { signal }),
  customer: (id, signal) => request(`/admin/customers/${id}`, { signal }),
  setCustomerStatus: (id, isBlocked) =>
    request(`/admin/customers/${id}/status`, {
      method: "PATCH",
      body: { isBlocked },
    }),
  deleteCustomer: (id) =>
    request(`/admin/customers/${id}`, { method: "DELETE" }),
  restoreCustomer: (id) =>
    request(`/admin/customers/${id}/restore`, { method: "POST" }),
};

import { useEffect, useState } from "react";
import API from "../../api/API.js";
export const titleCase = (value) =>
  (value || "Pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const orderDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
export async function downloadInvoice(order) {
  const { data } = await API.get(`/orders/${order.id}/invoice`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${order.orderId}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useCustomerOrder(id) {
  const [order, setOrder] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    API.get(`/orders/${id}`, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) {
          setOrder(r.data.data.order);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || e.message);
      });
    return () => controller.abort();
  }, [id, revision]);
  return {
    order: order?.id === id ? order : null,
    setOrder,
    error,
    refresh: () => setRevision((n) => n + 1),
  };
}

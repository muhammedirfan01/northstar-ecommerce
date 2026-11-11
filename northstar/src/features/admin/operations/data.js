import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import API from "../../../api/API.js";
export { default as API } from "../../../api/API.js";
export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: value % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
export function useDirectory(defaults = {}) {
  const [params, setParams] = useSearchParams();
  const values = {
    page: "1",
    limit: "10",
    search: "",
    ...defaults,
    ...Object.fromEntries(params),
  };
  function change(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }
  return {
    values,
    change,
    clear: () => setParams({}, { replace: true }),
    query: new URLSearchParams(values).toString(),
  };
}
export function useAdminData(url, poll = true) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      API.get(url, { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) {
            setData(r.data.data);
            setError("");
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e.response?.data?.message || e.message);
        });
    load();
    const timer = poll ? setInterval(load, 60000) : null;
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [url, reload, poll]);
  return { data, error, refresh: () => setReload((n) => n + 1) };
}
export const label = (value) =>
  (value || "Pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
export async function download(url, filename) {
  const response = await API.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(response.data),
    anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

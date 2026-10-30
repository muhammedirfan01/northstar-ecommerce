import { request } from "./request.js";

export const addressApi = {
  list: signal => request("/addresses", { signal }),
  add: body => request("/addresses", { method: "POST", body }),
  edit: (id, body) => request(`/addresses/${id}`, { method: "PATCH", body }),
  remove: (id, version) => request(`/addresses/${id}`, { method: "DELETE", body: { version } }),
  setDefault: (id, version) => request(`/addresses/${id}/default`, { method: "PATCH", body: { version } }),
};

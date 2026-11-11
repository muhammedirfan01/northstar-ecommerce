import { orderQuery } from "../utils/validators/order.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";
export function inventoryQuery(input = {}) {
  checkFields(input, [
    "page",
    "limit",
    "search",
    "category",
    "stockStatus",
    "sort",
  ]);
  const base = orderQuery({
    page: input.page,
    limit: input.limit,
    search: input.search,
  });
  if (input.category && !/^[a-f0-9]{24}$/i.test(input.category))
    throw httpError("Invalid category.", 400);
  if (
    input.stockStatus &&
    !["in_stock", "low_stock", "out_of_stock"].includes(input.stockStatus)
  )
    throw httpError("Invalid stock status.", 400);
  if (
    input.sort &&
    !["stock-asc", "stock-desc", "name", "updated"].includes(input.sort)
  )
    throw httpError("Invalid inventory sort.", 400);
  return {
    ...base,
    category: input.category,
    stockStatus: input.stockStatus,
    sort: input.sort || "stock-asc",
  };
}
export function inventoryFilter(query) {
  const filter = { deletedAt: null };
  if (query.search) {
    const pattern = {
      $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    filter.$or = [{ name: pattern }];
    if (/^[a-f0-9]{24}$/i.test(query.search))
      filter.$or.push({ _id: query.search });
  }
  if (query.category) filter.category = query.category;
  if (query.stockStatus === "out_of_stock") filter.stock = 0;
  if (query.stockStatus === "low_stock") filter.stock = { $gte: 1, $lte: 5 };
  if (query.stockStatus === "in_stock") filter.stock = { $gt: 5 };
  return filter;
}
export const inventorySort = (query) =>
  ({
    "stock-asc": { stock: 1, _id: 1 },
    "stock-desc": { stock: -1, _id: 1 },
    name: { name: 1, _id: 1 },
    updated: { updatedAt: -1, _id: -1 },
  })[query.sort];

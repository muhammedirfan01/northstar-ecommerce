import { ProductStatus } from '../constants/statuses.js';
// Keep this precedence aligned with the status shown by the admin table.
export const productStatusRules = Object.freeze([
  { status: ProductStatus.DELETED, condition: { $ne: [{ $ifNull: ['$deletedAt', null] }, null] } },
  { status: ProductStatus.UNLISTED, condition: { $eq: ['$isListed', false] } },
  { status: ProductStatus.DRAFT, condition: { $eq: ['$isPublished', false] } },
  { status: ProductStatus.OUT_OF_STOCK, condition: { $eq: ['$stock', 0] } },
]);
export const productStatusOrder = Object.freeze([ProductStatus.PUBLISHED, ProductStatus.OUT_OF_STOCK, ProductStatus.DRAFT, ProductStatus.UNLISTED, ProductStatus.DELETED]);
export function statusSortPipeline(filter, sort, page, limit) {
  return [
    { $match: filter },
    { $addFields: { statusRank: { $switch: {
      branches: productStatusRules.map((rule) => ({ case: rule.condition, then: productStatusOrder.indexOf(rule.status) })),
      default: 0,
    } } } },
    { $sort: { statusRank: sort === 'status-desc' ? -1 : 1, createdAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { statusRank: 0 } },
  ];
}

// Show customer requests to the admin and save status changes.

import SupportRequest from "../models/SupportRequest.js";
import {
  validateFormFields,
  validateText,
  validateId,
  validateQueryNumber,
} from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

function formatCustomerRequest(request) {
  return {
    id: String(request._id),
    reference: request.reference,
    name: request.name,
    email: request.email,
    subject: request.subject,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    version: request.__v ?? 0,
  };
}
export async function listRequests(requestData) {
  const query = requestData.query || {};
  validateFormFields(query, ["page", "limit", "search", "status"]);
  const requestedPage = validateQueryNumber(
      query.page ?? 1,
      "page",
      1,
      10000,
      true,
    ),
    limit = validateQueryNumber(query.limit ?? 10, "limit", 1, 50, true);
  const filter = {};
  if (query.status) {
    if (!["open", "in_progress", "closed"].includes(query.status))
      throw createError("Invalid request status.", 400);
    filter.status = query.status;
  }
  if (query.search !== undefined) {
    const search = validateText(query.search, "search", 0, 100);
    if (search) {
      const pattern = {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
      filter.$or = ["name", "email", "subject", "reference", "legacyReference"].map((fieldName) => ({
        [fieldName]: pattern,
      }));
    }
  }
  const [total, counts] = await Promise.all([
    SupportRequest.countDocuments(filter),
    SupportRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit)),
    page = Math.min(requestedPage, totalPages);
  const requests = await SupportRequest.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const summary = { total: 0, open: 0, in_progress: 0, closed: 0 };
  for (const row of counts) {
    if (["open", "in_progress", "closed"].includes(row._id))
      summary[row._id] = row.count;
    summary.total += row.count;
  }
  return {
    status: 200,
    body: {
      success: true,
      data: {
        requests: requests.map(formatCustomerRequest),
        summary,
        pagination: { total, totalPages, page, limit },
      },
    },
  };
}
export async function updateRequest(requestData) {
  const id = validateId(requestData.params.id, "id", "Invalid customer request ID.");
  validateFormFields(requestData.body, ["status", "version"]);
  const { status, version } = requestData.body;
  if (
    !["open", "in_progress", "closed"].includes(status) ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    throw createError("Invalid request status or version.", 400);
  const filter = {
    _id: id,
    ...(version === 0
      ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] }
      : { __v: version }),
  };
  const request = await SupportRequest.findOneAndUpdate(
    filter,
    {
      $set: {
        status,
        reviewedBy: requestData.user.id || requestData.user._id,
        reviewedAt: new Date(),
      },
      $inc: { __v: 1 },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!request) {
    if (!(await SupportRequest.exists({ _id: id })))
      throw createError("Customer request not found.", 404);
    throw createError("This request changed. Refresh before updating it.", 409);
  }
  return {
    status: 200,
    body: { success: true, data: { request: formatCustomerRequest(request) } },
  };
}

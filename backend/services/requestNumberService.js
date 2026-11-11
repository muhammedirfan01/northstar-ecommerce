import mongoose from "mongoose";
import OrderCounter from "../models/OrderCounter.js";
import SupportRequest from "../models/SupportRequest.js";
import { httpError } from "../utils/httpError.js";

const shortReference = /^REQ-\d{5,12}$/;
const counterId = "customer-requests";

export async function prepareRequestCounter(synchronize = false) {
  await Promise.all([OrderCounter.init(), SupportRequest.init()]);
  if (!synchronize && await OrderCounter.exists({ _id: counterId })) return;
  const requests = await SupportRequest.find({ reference: shortReference })
    .select("reference").lean();
  const value = requests.reduce((highest, request) =>
    Math.max(highest, Number(request.reference.slice(4))), 10000);
  try {
    await OrderCounter.updateOne({ _id: counterId }, { $max: { value } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await OrderCounter.updateOne({ _id: counterId }, { $max: { value } });
  }
}

export async function nextRequestReference(session = null) {
  const counter = await OrderCounter.findOneAndUpdate(
    { _id: counterId, value: { $lt: 999999999999 } },
    { $inc: { value: 1 } },
    { session, returnDocument: "after" },
  );
  if (!counter || !Number.isSafeInteger(counter.value))
    throw httpError("A request number could not be allocated. Please retry.", 503);
  return `REQ-${counter.value}`;
}

// Preserve old customer references for lookup while making all visible IDs readable.
export async function backfillRequestReferences() {
  await prepareRequestCounter(true);
  const cursor = SupportRequest.find({ reference: { $not: shortReference } })
    .sort({ createdAt: 1, _id: 1 }).select("_id").lean().cursor();
  for await (const row of cursor) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const request = await SupportRequest.findById(row._id).session(session);
        if (!request || shortReference.test(request.reference)) return;
        const reference = await nextRequestReference(session);
        await SupportRequest.updateOne(
          { _id: request._id, reference: request.reference },
          {
            $set: { reference, legacyReference: request.legacyReference || request.reference },
            $inc: { __v: 1 },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }
}

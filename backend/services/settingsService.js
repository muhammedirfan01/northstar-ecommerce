import StoreSettings, { DEFAULT_SETTINGS } from "../models/StoreSettings.js";
import { settingsForm } from "../utils/validators/business.js";
import { httpError } from "../utils/httpError.js";
import { paymentConfigured } from "./razorpayService.js";
export async function readSettings(session = null) {
  const doc = await StoreSettings.findById("northstar").session(session).lean();
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS).map((k) => [
        k,
        doc && Object.hasOwn(doc, k) ? doc[k] : DEFAULT_SETTINGS[k],
      ]),
    ),
    version: doc?.__v ?? 0,
  };
}
export async function getSettings() {
  return {
    status: 200,
    body: {
      success: true,
      data: {
        settings: await readSettings(),
        paymentConfigured: paymentConfigured(),
      },
    },
  };
}
export async function updateSettings(input) {
  const changes = settingsForm(input.body),
    v = input.body.version;
  // Create once at version 1; later writes use compare-and-swap, never an unguarded upsert.
  let doc = await StoreSettings.findOneAndUpdate(
    { _id: "northstar", __v: v },
    {
      $set: { ...changes, updatedBy: input.user.id || input.user._id },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" },
  );
  if (!doc && v === 0) {
    try {
      doc = await StoreSettings.collection.insertOne({
        _id: "northstar",
        ...changes,
        updatedBy: input.user.id || input.user._id,
        __v: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  if (!doc)
    throw httpError("Settings changed. Reload before saving again.", 409);
  return getSettings();
}

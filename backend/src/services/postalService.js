// Look up Indian PIN codes and check the address location.

import { createError } from "../utils/httpError.js";


const INDIA_PIN_LOOKUP_URL = "https://api.postalpincode.in/pincode/";
const cache = new Map();
const aliases = {
  orissa: "odisha",
  pondicherry: "puducherry",
  "nct of delhi": "delhi",
  "new delhi": "delhi",
  uttaranchal: "uttarakhand",
  "andaman and nicobar islands": "andaman nicobar islands",
  "dadra and nagar haveli and daman and diu": "dadra nagar haveli daman diu",
  "dadra and nagar haveli": "dadra nagar haveli daman diu",
  "daman and diu": "dadra nagar haveli daman diu",
};
export function normalizeStateName(value) {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[.&]/g, " ")
    .replace(/\s+/g, " ");
  return aliases[key] || key;
}
function createPostalError(message, fieldName = "postalCode") {
  const error = createError(message, 400);
  error.code = "VALIDATION_ERROR";
  error.data = { fieldErrors: { [fieldName]: message } };
  return error;
}
// Tests can replace this lookup. The website uses the real PIN-code service.
export const postalDirectory = {
  async lookup(pin) {
    if (typeof pin !== "string" || !/^[1-9][0-9]{5}$/.test(pin))
      throw createPostalError("Enter a valid six-digit Indian PIN code.");
    const saved = cache.get(pin);
    if (saved?.until > Date.now()) return saved.value;
    let endpoint = INDIA_PIN_LOOKUP_URL;
    // Only tests can use a local test server. The website always uses the real PIN-code address.
    if (process.env.NODE_ENV === "test" && process.env.POSTAL_TEST_ORIGIN) {
      const local = new URL(process.env.POSTAL_TEST_ORIGIN);
      if (
        local.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(local.hostname)
      )
        throw new Error("Postal test origin must be local.");
      endpoint = `${local.origin}/pincode/`;
    }
    let responseData;
    try {
      const response = await fetch(`${endpoint}${encodeURIComponent(pin)}`, {
        signal: AbortSignal.timeout(8000),
        redirect: "error",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 500000) throw new Error();
      responseData = JSON.parse(text);
    } catch {
      throw createError(
        "Postal lookup is temporarily unavailable. Please retry before saving your address.",
        503,
      );
    }
    const record = Array.isArray(responseData) && responseData.length === 1 ? responseData[0] : null;
    if (record?.Status === "Error" && record.PostOffice === null)
      throw createPostalError("This PIN code was not found. Check the six digits.");
    const offices = record?.PostOffice;
    if (
      record?.Status !== "Success" ||
      !Array.isArray(offices) ||
      !offices.length ||
      offices.some(
        (item) =>
          String(item.Pincode) !== pin ||
          typeof item.State !== "string" ||
          !item.State.trim() ||
          item.State.length > 80 ||
          typeof item.District !== "string" ||
          item.District.length > 100,
      )
    )
      throw createError(
        "Postal data could not be verified. Please try again.",
        503,
      );
    const state = offices[0].State.trim();
    if (
      offices.some(
        (item) => normalizeStateName(item.State) !== normalizeStateName(state),
      )
    )
      throw createError("Postal data is inconsistent. Please try again.", 503);
    const value = {
      state,
      districts: [
        ...new Set(offices.map((item) => item.District.trim()).filter(Boolean)),
      ],
      states: [...new Set(offices.map((office) => office.State.trim()).filter(Boolean))],
    };
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(pin, { value, until: Date.now() + 3600000 });
    return value;
  },
};
export async function validatePostalAddress(details) {
  const location = await postalDirectory.lookup(details.postalCode);
  if (!location.districts.some((district) => district.trim().toLowerCase() === details.city.trim().toLowerCase()))
    throw createPostalError(
      `City does not match PIN ${details.postalCode}. Choose a matching district from the PIN code suggestions.`,
      "city",
    );
  details.state = location.state;
}
export async function getPostalLocation(requestData) {
  const responseData = await postalDirectory.lookup(requestData.params.pin);
  return { status: 200, body: { success: true, data: responseData } };
}

export async function lookupIndiaPincode(postalCode) {
  try { const { states, districts } = await postalDirectory.lookup(postalCode); return { states, districts }; }
  catch (error) { if (error.status === 400) return null; throw error; }
}

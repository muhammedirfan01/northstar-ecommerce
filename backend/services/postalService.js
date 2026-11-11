import { httpError } from "../utils/httpError.js";
import { cityMatches } from "../../shared/postalLocations.mjs";

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
export function normalizedState(value) {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[.&]/g, " ")
    .replace(/\s+/g, " ");
  return aliases[key] || key;
}
function postalError(message, field = "postalCode") {
  const error = httpError(message, 400);
  error.code = "VALIDATION_ERROR";
  error.data = { fieldErrors: { [field]: message } };
  return error;
}
// Mutable dependency boundary permits focused unit tests; production uses real HTTP.
export const postalDirectory = {
  async lookup(pin) {
    if (typeof pin !== "string" || !/^[1-9][0-9]{5}$/.test(pin))
      throw postalError("Enter a valid six-digit Indian PIN code.");
    const saved = cache.get(pin);
    if (saved?.until > Date.now()) return saved.value;
    let endpoint = "https://api.postalpincode.in";
    // Only isolated tests may point at a local HTTP simulator; production host is fixed.
    if (process.env.NODE_ENV === "test" && process.env.POSTAL_TEST_ORIGIN) {
      const local = new URL(process.env.POSTAL_TEST_ORIGIN);
      if (
        local.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(local.hostname)
      )
        throw new Error("Postal test origin must be local.");
      endpoint = local.origin;
    }
    let data;
    try {
      const response = await fetch(`${endpoint}/pincode/${pin}`, {
        signal: AbortSignal.timeout(6000),
        redirect: "error",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 500000) throw new Error();
      data = JSON.parse(text);
    } catch {
      throw httpError(
        "Postal lookup is temporarily unavailable. Please retry before saving your address.",
        503,
      );
    }
    const record = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (record?.Status === "Error" && record.PostOffice === null)
      throw postalError("This PIN code was not found. Check the six digits.");
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
      throw httpError(
        "Postal data could not be verified. Please try again.",
        503,
      );
    const state = offices[0].State.trim();
    if (
      offices.some(
        (item) => normalizedState(item.State) !== normalizedState(state),
      )
    )
      throw httpError("Postal data is inconsistent. Please try again.", 503);
    const value = {
      state,
      districts: [
        ...new Set(offices.map((item) => item.District.trim()).filter(Boolean)),
      ],
      cities: [
        ...new Set(
          offices
            .flatMap((office) => [office.Name, office.Block, office.District])
            .filter(
              (name) =>
                typeof name === "string" &&
                name.trim().length >= 2 &&
                name.trim().length <= 80 &&
                !/^(NA|N\/A|Not Available)$/i.test(name.trim()),
            )
            .map((name) => name.trim()),
        ),
      ],
    };
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(pin, { value, until: Date.now() + 3600000 });
    return value;
  },
};
export async function validatePostalAddress(details) {
  const location = await postalDirectory.lookup(details.postalCode);
  if (!cityMatches(details.city, location.cities || location.districts))
    throw postalError(
      `City does not match PIN ${details.postalCode}. Choose a matching city or locality from the suggestions.`,
      "city",
    );
  details.state = location.state;
}
export async function getPostalLocation(input) {
  const data = await postalDirectory.lookup(input.params.pin);
  return { status: 200, body: { success: true, data } };
}

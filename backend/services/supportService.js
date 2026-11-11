import { createHash } from "node:crypto";
import { prepareRequestCounter, nextRequestReference } from "./requestNumberService.js";
import SupportRequest from "../models/SupportRequest.js";
import { readSettings } from "./settingsService.js";
import { checkFields, readText } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";

export async function getContact() {
  const settings = await readSettings();
  return {
    status: 200,
    body: {
      success: true,
      data: {
        storeName: settings.storeName,
        email: settings.supportEmail,
        phone: settings.supportPhone,
        address: settings.invoiceAddress,
      },
    },
  };
}
export async function sendMessage(input) {
  checkFields(input.body, ["name", "email", "subject", "message", "requestId"]);
  const name = readText(input.body.name, "name", 2, 80);
  const email = readText(input.body.email, "email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw httpError("Enter a valid email address.", 400);
  const subject = readText(input.body.subject, "subject", 3, 120);
  const message = readText(input.body.message, "message", 10, 3000);
  const requestId = input.body.requestId;
  if (
    typeof requestId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      requestId,
    )
  )
    throw httpError("Invalid request reference.", 400);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([name, email, subject, message]))
    .digest("hex");
  let ticket = await SupportRequest.findOne({ requestId });
  let status = 200;
  if (!ticket) {
    await prepareRequestCounter();
    try {
      ticket = await SupportRequest.create({
        requestId,
        fingerprint,
        name,
        email,
        subject,
        message,
        reference: await nextRequestReference(),
      });
      status = 201;
    } catch (error) {
      if (error.code !== 11000) throw error;
      ticket = await SupportRequest.findOne({ requestId });
      if (!ticket) throw error;
    }
  }
  if (ticket.fingerprint !== fingerprint)
    throw httpError(
      "This request reference was already used. Start a new message.",
      409,
    );
  return {
    status,
    body: { success: true, data: { reference: ticket.reference } },
  };
}

// Show store contact details and save customer messages.

import { STORE } from "../constants/store.js";
import { createHash } from "node:crypto";
import { prepareRequestCounter, nextRequestReference } from "./requestNumberService.js";
import SupportRequest from "../models/SupportRequest.js";
import { validateFormFields, validateText } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

export async function getContact() {
  return {
    status: 200,
    body: {
      success: true,
      data: {
        storeName: STORE.storeName,
        email: STORE.supportEmail,
        phone: STORE.supportPhone,
        address: STORE.invoiceAddress,
      },
    },
  };
}
export async function sendMessage(requestData) {
  validateFormFields(requestData.body, ["name", "email", "subject", "message", "requestId"]);
  const name = validateText(requestData.body.name, "name", 2, 80);
  const email = validateText(requestData.body.email, "email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw createError("Enter a valid email address.", 400);
  const subject = validateText(requestData.body.subject, "subject", 3, 120);
  const message = validateText(requestData.body.message, "message", 10, 3000);
  const requestId = requestData.body.requestId;
  if (
    typeof requestId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      requestId,
    )
  )
    throw createError("Invalid request reference.", 400);
  const requestHash = createHash("sha256")
    .update(JSON.stringify([name, email, subject, message]))
    .digest("hex");
  let ticket = await SupportRequest.findOne({ requestId });
  let status = 200;
  if (!ticket) {
    await prepareRequestCounter();
    try {
      ticket = await SupportRequest.create({
        requestId,
        fingerprint: requestHash,
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
  if (ticket.fingerprint !== requestHash)
    throw createError(
      "This request reference was already used. Start a new message.",
      409,
    );
  return {
    status,
    body: { success: true, data: { reference: ticket.reference } },
  };
}

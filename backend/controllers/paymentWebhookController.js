import { makeServiceInput } from "./makeServiceInput.js";
import * as paymentWebhookService from "../services/paymentWebhookService.js";

export async function receiveWebhook(req, res) {
  const result = await paymentWebhookService.receiveWebhook({
    ...makeServiceInput(req),
    signature: req.get("x-razorpay-signature"),
    eventId: req.get("x-razorpay-event-id"),
  });
  return res.status(result.status).json(result.body);
}

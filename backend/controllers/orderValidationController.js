import { makeServiceInput } from "./makeServiceInput.js";
import * as orderService from "../services/orderService.js";
export async function checkout(req, res) {
  const result = await orderService.checkout(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

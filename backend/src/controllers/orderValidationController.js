import { inputFrom } from "./requestInput.js";
import * as orderService from "../services/orderService.js";
export async function checkout(req, res) {
  const result = await orderService.calculateOrder(inputFrom(req));
  return res.status(result.status).json(result.body);
}

import { makeServiceInput } from "./makeServiceInput.js";
import * as inventoryService from "../services/inventoryService.js";

export async function listInventory(req, res) {
  const result = await inventoryService.listInventory(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateStock(req, res) {
  const result = await inventoryService.updateStock(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

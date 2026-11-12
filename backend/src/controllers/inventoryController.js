import { inputFrom } from "./requestInput.js";
import * as inventoryService from "../services/inventoryService.js";

export async function listInventory(req, res) {
  const result = await inventoryService.listInventory(inputFrom(req));
  return res.status(result.status).json(result.body);
}


import { inputFrom } from "./requestInput.js";
import * as adminRequestService from "../services/adminRequestService.js";
export async function listRequests(req, res) {
  const result = await adminRequestService.listRequests(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function updateRequest(req, res) {
  const result = await adminRequestService.updateRequest(inputFrom(req));
  return res.status(result.status).json(result.body);
}

import { makeServiceInput } from "./makeServiceInput.js";
import * as adminRequestService from "../services/adminRequestService.js";
export async function listRequests(req, res) {
  const result = await adminRequestService.listRequests(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function updateRequest(req, res) {
  const result = await adminRequestService.updateRequest(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

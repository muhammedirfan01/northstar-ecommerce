import { makeServiceInput } from "./makeServiceInput.js";
import * as registrationService from "../services/registrationService.js";

export async function register(req, res) {
  const result = await registrationService.register(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

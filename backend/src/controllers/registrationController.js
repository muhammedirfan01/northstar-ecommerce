import { inputFrom } from "./requestInput.js";
import * as registrationService from "../services/registrationService.js";

export async function register(req, res) {
  const result = await registrationService.register(inputFrom(req));
  return res.status(result.status).json(result.body);
}

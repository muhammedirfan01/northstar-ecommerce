import * as registrationService from "../services/registrationService.js";

export async function register(req, res) {
  const result = await registrationService.register({
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

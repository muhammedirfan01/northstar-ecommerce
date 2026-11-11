import { makePublicServiceInput } from "./makeServiceInput.js";
import { issueAuthCookie } from "../utils/jwt.js";
import * as googleSignInService from "../services/googleSignInService.js";
export async function googleSignIn(req, res) {
  const result = await googleSignInService.googleSignIn(makePublicServiceInput(req));
  if (result.authUser) {
    issueAuthCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}

import { inputWithUrl } from "./requestInput.js";
import { setLoginCookie } from "../utils/jwt.js";
import * as googleSignInService from "../services/googleSignInService.js";
export async function googleSignIn(req, res) {
  const result = await googleSignInService.googleSignIn(inputWithUrl(req));
  if (result.authUser) {
    setLoginCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}

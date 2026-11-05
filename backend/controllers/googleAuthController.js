import { issueAuthCookie } from "../utils/jwt.js";
import * as googleSignInService from "../services/googleSignInService.js";
export async function googleSignIn(req, res) {
  const result = await googleSignInService.googleSignIn({
    body: req.body,
    apiBaseUrl: req.headers?.host
      ? `${req.protocol || "http"}://${req.headers.host}/api`
      : "",
  });
  if (result.authUser) {
    issueAuthCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}

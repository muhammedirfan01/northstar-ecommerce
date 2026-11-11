import { makePublicServiceInput } from "./makeServiceInput.js";
import { issueAuthCookie, clearAuthCookie } from "../utils/jwt.js";
import { publicUser } from "../middlewares/auth.js";
import * as loginService from "../services/loginService.js";
export function currentUser(req, res) {
  return res.json({
    success: true,
    data: {
      user: publicUser(
        req.user,
        req.headers?.host
          ? `${req.protocol || "http"}://${req.headers.host}/api`
          : "",
      ),
    },
  });
}
export function logout(req, res) {
  clearAuthCookie(res);
  return res.json({
    success: true,
    message: "Logged out successfully",
  });
}
export async function startLogin(req, res) {
  const result = await loginService.startLogin(makePublicServiceInput(req));
  if (result.authUser) {
    issueAuthCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}

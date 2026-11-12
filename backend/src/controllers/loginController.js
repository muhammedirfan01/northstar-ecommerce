import { inputWithUrl } from "./requestInput.js";
import { setLoginCookie, clearLoginCookie } from "../utils/jwt.js";
import { formatUser } from "../middlewares/auth.js";
import * as loginService from "../services/loginService.js";
export function currentUser(req, res) {
  return res.json({
    success: true,
    data: {
      user: formatUser(
        req.user,
        req.headers?.host
          ? `${req.protocol || "http"}://${req.headers.host}/api`
          : "",
      ),
    },
  });
}
export function logout(req, res) {
  clearLoginCookie(res);
  return res.json({
    success: true,
    message: "Logged out successfully",
  });
}
export async function startLogin(req, res) {
  const result = await loginService.startLogin(inputWithUrl(req));
  if (result.authUser) {
    setLoginCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}

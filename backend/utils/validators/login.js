import { checkObject } from "../formValidation.js";
import { readEmail, readPassword } from "../accountValidation.js";
export function checkLogin(input) {
  checkObject(input);
  const email = readEmail(input.email);
  const password = readPassword(input.password, "password", 1);
  return {
    email,
    password,
  };
}

import { nameError } from "../nameValidation.js";
import { validationError } from "../validation.js";
import { checkFields } from "../formValidation.js";
import { readEmail, readPassword } from "../accountValidation.js";
export function checkRegistration(input) {
  checkFields(input, ["name", "email", "password", "acceptedTerms"]);
  const invalidName = nameError(input.name);
  if (invalidName) throw validationError(invalidName, "name");
  const name = input.name.trim();
  const email = readEmail(input.email);
  const password = readPassword(input.password, "password");
  if (input.acceptedTerms !== true) {
    throw validationError("Invalid acceptedTerms.", "acceptedTerms");
  }
  return {
    name,
    email,
    password,
    acceptedTerms: true,
  };
}

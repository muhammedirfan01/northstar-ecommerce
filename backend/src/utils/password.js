import * as argon2 from "argon2";
export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

// Check whether a submitted password matches the saved hash.
export async function verifyPassword(savedPasswordHash, password) {
  return argon2.verify(savedPasswordHash, password);
}

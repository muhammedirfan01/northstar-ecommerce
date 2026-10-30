import { z } from "zod";

export const nameSchema = z.string().trim()
  .min(2, "Enter a name with at least 2 letters.")
  .max(80, "Use no more than 80 characters for your name.")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces, apostrophes, periods or hyphens in your name.")
  .refine(name => (name.match(/\p{L}/gu) || []).length >= 2, "Enter a name with at least 2 letters.");

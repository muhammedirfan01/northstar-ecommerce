import {z} from "zod";
export const nameSchema=z.string().trim().min(2,"Enter at least 2 characters")
.max(30,"maximum character lenghth is 30")
.regex(/^[a-zA-Z ]+$/,"only English letters are allowed");
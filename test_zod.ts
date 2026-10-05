import { z } from "zod";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(60_000),
  theme: z
    .string()
    .regex(/^[A-Za-z &]{1,40} \(accent #[0-9a-fA-F]{6}\)$/)
    .optional(),
});

const payload = {
  text: "Hello, I would like to schedule a brief meeting...",
  theme: "Indigo & Professional (accent #4f46e5)"
};

const result = bodySchema.safeParse(payload);
console.log(JSON.stringify(result, null, 2));

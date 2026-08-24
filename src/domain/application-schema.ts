import { z } from "zod";

import { CLASS_NAMES, WOW_CLASSES } from "@/lib/wow";

const urlOrEmpty = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === "" || /^https:\/\/(www\.)?(warcraftlogs\.com|raider\.io)\//.test(v),
    "Must be a warcraftlogs.com or raider.io link",
  )
  .optional()
  .or(z.literal(""));

export const applicationSchema = z
  .object({
    discordName: z.string().trim().min(2, "Required").max(64),
    characterName: z.string().trim().min(2, "Required").max(24),
    realm: z.string().trim().min(2, "Required").max(64),
    className: z.string().refine((v) => CLASS_NAMES.includes(v), "Pick a class"),
    specName: z.string().trim().min(2, "Pick a spec").max(32),
    altSpecs: z.string().trim().max(120).optional().or(z.literal("")),
    warcraftLogsUrl: urlOrEmpty,
    raiderIoUrl: urlOrEmpty,
    previousGuild: z.string().trim().max(100).optional().or(z.literal("")),
    raidExperience: z.string().trim().min(10, "Tell us a bit more").max(2000),
    availability: z.string().trim().min(2, "Required").max(300),
    expectations: z.string().trim().max(2000).optional().or(z.literal("")),
    whyPapi: z.string().trim().min(10, "Tell us a bit more").max(2000),
    comment: z.string().trim().max(2000).optional().or(z.literal("")),
    /** Honeypot — must stay empty. Bots love filling in every field. */
    website: z.string().max(0, "").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const specs = WOW_CLASSES[data.className]?.specs.map((s) => s.name) ?? [];
    if (specs.length > 0 && !specs.includes(data.specName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["specName"],
        message: `Not a ${data.className} spec`,
      });
    }
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;

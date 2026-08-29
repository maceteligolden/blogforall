import { z } from "zod";
import { REQUIRED_FRAMER_FIELDS } from "../constants";

export const framerTestBodySchema = z.object({
  projectUrl: z.string().min(8).max(500),
  apiKey: z.string().min(8).max(500),
});

export const framerSaveBodySchema = z.object({
  projectUrl: z.string().min(8).max(500),
  apiKey: z.string().min(8).max(500),
  collectionId: z.string().min(1).max(200),
  collectionName: z.string().min(1).max(200),
  fieldMap: z
    .record(
      z.enum(["title", "content", "slug", "excerpt", "featured_image", "published_at"]),
      z.string().min(1).max(200)
    )
    .refine((map) => REQUIRED_FRAMER_FIELDS.every((field) => Boolean(map[field])), {
      message: "title and content must be mapped to Framer fields",
    }),
  autoDeploy: z.boolean().optional().default(true),
});

export const publishDestinationsBodySchema = z
  .object({
    destinations: z
      .array(z.enum(["bloggr", "framer"]))
      .max(4)
      .optional(),
  })
  .default({});

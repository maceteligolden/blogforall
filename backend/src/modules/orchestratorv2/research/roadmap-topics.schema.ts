import { z } from "zod";

export const RoadmapTopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().min(1),
        about: z.string().min(1),
        keywords: z.array(z.string()).max(8).default([]),
        post_type: z.enum([
          "article",
          "tutorial",
          "how_to",
          "listicle",
          "opinion",
          "case_study",
          "definitive_guide",
          "software_roundup",
          "comparison",
          "thought_leadership",
        ]),
        campaign_support: z.string().min(1),
      })
    )
    .min(1)
    .max(20),
});

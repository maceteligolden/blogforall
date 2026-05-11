/**
 * Blog AI configuration (LangGraph + OpenAI + optional Tavily).
 * Values are resolved in shared/config/env.ts.
 */

import { env } from "../config/env";

export const BlogAiConfig = env.blogAi;
/** Alias for existing imports in blog generation code paths. */
export const BlogGenerationConfig = env.blogAi;

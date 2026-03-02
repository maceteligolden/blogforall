import { injectable } from "tsyringe";
import { BlogReviewConfig } from "../constants/blog-review.constant";

/** OpenAI-compatible chat endpoint; model is sent in the request body and the router selects the provider. */
const HF_ROUTER_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

@injectable()
export class HuggingFaceFacade {
 
    constructor() {}

    async hfChatCompletion(
    model: string,
    messages: { role: string; content: string }[],
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    const token = BlogReviewConfig.HUGGINGFACE_API_TOKEN;
    // Force hf-inference so the request is served by Hugging Face and your HF token is used (router otherwise may send to Together AI etc.).
    const modelWithProvider = model.includes(":") ? model : `${model}:hf-inference`;
    const res = await fetch(HF_ROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: modelWithProvider,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) {
      const contentType = res.headers.get("Content-Type");
      let body: unknown;
      try {
        body = contentType?.includes("application/json") ? await res.json() : await res.text();
      } catch {
        body = "";
      }
      const err = new Error(
        typeof body === "object" &&
          body !== null &&
          "error" in (body as object) &&
          typeof (body as { error: unknown }).error === "object" &&
          (body as { error: { message?: string } }).error?.message
          ? (body as { error: { message: string } }).error.message
          : `HTTP ${res.status}`
      ) as Error & { httpResponse?: { status: number; body: unknown } };
      (err as Error & { httpResponse?: { status: number; body: unknown } }).httpResponse = { status: res.status, body };
      throw err;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    return content;
  }
}
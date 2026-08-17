import { Request, Response, NextFunction } from "express";
import { injectable } from "tsyringe";
import { sendSuccess } from "../../shared/helper/response.helper";
import { getJwtUserId } from "../../shared/utils/jwt-user";
import { getRequestIdFromHeaders } from "../../shared/utils/request-id";
import OrchestratorV2Service from "./orchestrator.service";
import type { ClientSessionMode } from "../orchestrator/utils/turn-context.helper";
import { ElevenLabsTtsService } from "../orchestrator/services/elevenlabs-tts.service";

function splitReplyIntoSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [cleaned];
}

function stringField(data: unknown, key: string): string {
  if (!data || typeof data !== "object") return "";
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

type ChatBody = {
  thread_id?: string;
  message: string;
  session_mode?: ClientSessionMode;
  conversation_mode?: boolean;
  focus?: {
    campaign_id?: string;
    roadmap_sequence_index?: number;
    blog_id?: string;
    topic?: string;
    intent?: string;
  };
  selection_context?: {
    blog_id: string;
    reference_type?: "highlight" | "blog";
    text?: string;
  };
  attachments?: Array<{
    name: string;
    url: string;
    mime_type: string;
    extracted_text?: string;
  }>;
};

@injectable()
export default class OrchestratorV2controller {
  constructor(
    private orchestratorService: OrchestratorV2Service,
    private elevenLabsTts: ElevenLabsTtsService,
  ) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const body = req.validatedBody as ChatBody;

      const response = await this.orchestratorService.chat({
        siteId,
        userId,
        message: body.message,
        threadId: body.thread_id,
        sessionMode: body.session_mode,
        conversationMode: Boolean(body.conversation_mode),
        focus: body.focus,
        selectionContext: body.selection_context,
        attachments: body.attachments,
      });

      const requestId = getRequestIdFromHeaders(req);
      if (requestId) {
        res.setHeader("X-Request-Id", requestId);
      }
      sendSuccess(res, "OK", response);
    } catch (error) {
      next(error);
    }
  };

  chatStream = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const body = req.validatedBody as ChatBody;

      const response = await this.orchestratorService.chat({
        siteId,
        userId,
        message: body.message,
        threadId: body.thread_id,
        sessionMode: body.session_mode,
        conversationMode: Boolean(body.conversation_mode),
        focus: body.focus,
        selectionContext: body.selection_context,
        attachments: body.attachments,
      });

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      const requestId = getRequestIdFromHeaders(req);
      if (requestId) {
        res.setHeader("X-Request-Id", requestId);
      }
      const flush = (res as Response & { flushHeaders?: () => void }).flushHeaders?.bind(
        res,
      );
      flush?.();

      const emit = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      if (body.conversation_mode) {
        const spoken =
          response.tool_calls
            ?.slice()
            .reverse()
            .map((call) => stringField(call.output_data, "spoken_summary"))
            .find(Boolean) || response.assistant_message.content;
        const sentences = splitReplyIntoSentences(spoken);
        for (const sentence of sentences) {
          emit("sentence", { text: sentence });
        }
      }

      emit("done", response);
      res.end();
    } catch (error) {
      if (res.headersSent) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: "Chat stream failed" })}\n\n`,
        );
        res.end();
        return;
      }
      next(error);
    }
  };

  voiceTts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text } = req.validatedBody as { text: string };
      const audio = await this.elevenLabsTts.synthesize(text);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.send(audio);
    } catch (error) {
      next(error);
    }
  };
}

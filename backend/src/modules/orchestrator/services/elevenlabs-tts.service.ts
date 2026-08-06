import { injectable } from "tsyringe";
import { BadRequestError } from "../../../shared/errors";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";

/**
 * Server-side ElevenLabs TTS for voice call mode (doc 22 §8).
 */
@injectable()
export class ElevenLabsTtsService {
  async synthesize(text: string): Promise<Buffer> {
    const apiKey = env.elevenlabs.apiKey;
    if (!apiKey) {
      throw new BadRequestError("ElevenLabs TTS is not configured (ELEVENLABS_API_KEY missing)");
    }

    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestError("text is required");
    }

    const voiceId = env.elevenlabs.voiceId;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: trimmed.slice(0, 2500),
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.warn(
        "ElevenLabs TTS failed",
        { status: res.status, body: errBody.slice(0, 200) },
        "ElevenLabsTtsService"
      );
      throw new BadRequestError(`ElevenLabs TTS failed (${res.status})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

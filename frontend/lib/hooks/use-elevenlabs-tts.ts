"use client";

import { useCallback, useEffect, useRef } from "react";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { useSpeechSynthesis } from "@/lib/hooks/use-speech-synthesis";

type QueueItem = {
  text: string;
  onEnd?: () => void;
};

/**
 * ElevenLabs TTS via server, with browser speechSynthesis fallback.
 * Queues sentences so callers can pipeline speak(sentence1) while TTS for sentence2 loads.
 */
export function useElevenLabsTts(siteId: string | null | undefined) {
  const { speak: browserSpeak, stop: browserStop } = useSpeechSynthesis();
  const queueRef = useRef<QueueItem[]>([]);
  const playingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);
  const idleCallbackRef = useRef<(() => void) | null>(null);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const notifyIdle = useCallback(() => {
    if (playingRef.current || queueRef.current.length > 0) return;
    const cb = idleCallbackRef.current;
    idleCallbackRef.current = null;
    cb?.();
  }, []);

  const playNext = useCallback(async () => {
    if (playingRef.current || stoppedRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      notifyIdle();
      return;
    }

    playingRef.current = true;
    const finish = () => {
      playingRef.current = false;
      next.onEnd?.();
      if (!stoppedRef.current) {
        void playNext();
      }
    };

    const speakBrowser = () => {
      browserSpeak(next.text, finish);
    };

    if (!siteId || !next.text.trim()) {
      speakBrowser();
      return;
    }

    try {
      const blob = await OrchestratorService.synthesizeTts(siteId, next.text);
      if (stoppedRef.current) {
        playingRef.current = false;
        return;
      }
      cleanupAudio();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        cleanupAudio();
        finish();
      };
      audio.onerror = () => {
        cleanupAudio();
        speakBrowser();
      };
      await audio.play();
    } catch {
      if (stoppedRef.current) {
        playingRef.current = false;
        return;
      }
      speakBrowser();
    }
  }, [browserSpeak, cleanupAudio, notifyIdle, siteId]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!text.trim()) {
        onEnd?.();
        return;
      }
      stoppedRef.current = false;
      queueRef.current.push({ text, onEnd });
      void playNext();
    },
    [playNext]
  );

  /** Fires once when the speak queue drains (or immediately if already idle). */
  const whenIdle = useCallback((cb: () => void) => {
    if (!playingRef.current && queueRef.current.length === 0) {
      cb();
      return;
    }
    idleCallbackRef.current = cb;
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    queueRef.current = [];
    playingRef.current = false;
    idleCallbackRef.current = null;
    cleanupAudio();
    browserStop();
  }, [browserStop, cleanupAudio]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      queueRef.current = [];
      idleCallbackRef.current = null;
      cleanupAudio();
      browserStop();
    };
  }, [browserStop, cleanupAudio]);

  return { speak, stop, whenIdle };
}

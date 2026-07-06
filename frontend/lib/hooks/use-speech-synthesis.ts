"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFERRED_VOICE_PATTERNS = [
  /samantha/i,
  /natural/i,
  /neural/i,
  /google uk english female/i,
  /google us english/i,
  /karen/i,
  /daniel/i,
  /moira/i,
  /fiona/i,
];

function scoreVoice(voice: SpeechSynthesisVoice): number {
  let score = 0;
  if (voice.lang.startsWith("en")) score += 10;
  if (voice.localService) score += 2;
  for (let i = 0; i < PREFERRED_VOICE_PATTERNS.length; i++) {
    if (PREFERRED_VOICE_PATTERNS[i].test(voice.name)) {
      score += 20 - i;
    }
  }
  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return sorted[0] ?? null;
}

function stripForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`~]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSpokenChunk(text: string, maxLen = 400): string {
  const clean = stripForSpeech(text);
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("?"), slice.lastIndexOf("!"));
  if (lastStop > 80) return slice.slice(0, lastStop + 1).trim();
  return `${slice.trim()}…`;
}

export function useSpeechSynthesis() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [voicesReady, setVoicesReady] = useState(false);

  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!isSupported) return;
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voiceRef.current = pickBestVoice(voices);
        setVoicesReady(true);
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [isSupported]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!isSupported || !text.trim()) {
        onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const spoken = firstSpokenChunk(text);
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      } else if (voicesReady) {
        const voices = window.speechSynthesis.getVoices();
        voiceRef.current = pickBestVoice(voices);
        if (voiceRef.current) utterance.voice = voiceRef.current;
      }
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, voicesReady]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
  }, [isSupported]);

  return { isSupported, speak, stop };
}

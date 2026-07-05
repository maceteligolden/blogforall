"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_RATIO = 0.58;
const MIN_RATIO = 0.28;
const MAX_RATIO = 0.72;

export function useResizableSplit(storageKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [isDragging, setIsDragging] = useState(false);
  const ratioRef = useRef(ratio);

  useEffect(() => {
    ratioRef.current = ratio;
  }, [ratio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed = parseFloat(stored);
    if (!Number.isNaN(parsed) && parsed >= MIN_RATIO && parsed <= MAX_RATIO) {
      setRatio(parsed);
    }
  }, [storageKey]);

  const persistRatio = useCallback(
    (value: number) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(storageKey, String(value));
    },
    [storageKey]
  );

  const onSeparatorPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onSeparatorPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = (e.clientX - rect.left) / rect.width;
    setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)));
  }, []);

  const onSeparatorPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      persistRatio(ratioRef.current);
    },
    [persistRatio]
  );

  useEffect(() => {
    if (!isDragging) return;
    const prev = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = prevSelect;
    };
  }, [isDragging]);

  return {
    containerRef,
    ratio,
    isDragging,
    onSeparatorPointerDown,
    onSeparatorPointerMove,
    onSeparatorPointerUp,
  };
}

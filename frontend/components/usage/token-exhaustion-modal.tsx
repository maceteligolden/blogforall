"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface TokenExhaustionModalProps {
  isOpen: boolean;
  onClose: () => void;
  resetAt: string | null;
  message?: string;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "soon";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TokenExhaustionModal({
  isOpen,
  onClose,
  resetAt,
  message,
}: TokenExhaustionModalProps) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!isOpen || !resetAt) {
      setCountdown("");
      return;
    }
    const target = new Date(resetAt).getTime();
    const tick = () => {
      setCountdown(formatCountdown(target - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, resetAt]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily AI limit reached"
      size="sm"
      footer={<ExhaustionModalFooter onClose={onClose} />}
    >
      <p className="text-gray-300 text-sm leading-relaxed">
        {message ??
          "You have used your account's daily AI token allowance. New AI requests will work again after your window resets."}
      </p>
      {resetAt && (
        <p className="mt-3 text-sm text-gray-400">
          Resets in{" "}
          <span className="text-white font-medium tabular-nums">{countdown || "…"}</span>
        </p>
      )}
    </Modal>
  );
}

function ExhaustionModalFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:justify-end w-full">
      <Button
        variant="outline"
        onClick={onClose}
        className="border-gray-700 text-gray-300 hover:bg-gray-800"
      >
        Close
      </Button>
      <Link href="/dashboard/billing" onClick={onClose}>
        <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white">
          Upgrade plan
        </Button>
      </Link>
    </div>
  );
}

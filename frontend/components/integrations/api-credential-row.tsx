"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApiCredentialRow({
  label,
  value,
  onCopy,
  obscure,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  obscure?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div>
      <Label className="text-gray-400">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          value={value}
          readOnly
          type={obscure && !revealed ? "password" : "text"}
          className="border-gray-700 bg-black font-mono text-sm text-gray-300"
        />
        {obscure ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
            onClick={() => setRevealed((prev) => !prev)}
          >
            {revealed ? "Hide" : "Show"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={onCopy}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

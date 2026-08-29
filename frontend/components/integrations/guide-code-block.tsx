"use client";

import { useState } from "react";

export function GuideCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-black p-4">
        <code className="font-mono text-sm text-gray-300">{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 rounded border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

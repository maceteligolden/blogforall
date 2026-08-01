import { PROOF_STRIP } from "@/lib/landing/landing-copy";

export function ProofStrip() {
  return (
    <section className="border-y border-gray-800/60 py-5 px-6 lg:px-8" aria-label="Positioning">
      <p className="landing-caption text-center text-gray-400 max-w-3xl mx-auto">{PROOF_STRIP}</p>
    </section>
  );
}

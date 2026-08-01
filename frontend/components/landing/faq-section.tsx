"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "./reveal";
import { FAQ_ITEMS } from "@/lib/landing/landing-copy";
import { cn } from "@/lib/utils/cn";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-2xl mx-auto">
        <Reveal>
          <h2 className="landing-section-title text-white text-center mb-10 lg:mb-12">Questions</h2>
        </Reveal>
        <div className="divide-y divide-gray-800 border-y border-gray-800">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = open === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;
            return (
              <div key={item.q}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left text-white hover:text-primary transition-colors min-h-[48px]"
                  >
                    <span className="font-medium text-sm sm:text-base pr-2">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 motion-reduce:transition-none",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className={cn(!isOpen && "hidden")}
                >
                  <p className="pb-5 text-sm text-gray-400 leading-relaxed pr-8">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

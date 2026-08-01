import { Reveal } from "./reveal";
import { StartFreeButton } from "./start-free-button";
import { COMPARE, LANDING_CTAS } from "@/lib/landing/landing-copy";

export function CompareSection() {
  return (
    <section id="compare" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="landing-section-title text-white text-center mb-3">{COMPARE.h2}</h2>
          <p className="landing-body text-center max-w-2xl mx-auto mb-10 lg:mb-12">{COMPARE.intro}</p>
        </Reveal>

        <Reveal>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[640px] text-sm border-collapse">
              <caption className="sr-only">Comparison of ChatGPT, typical AI writers, and Bloggr</caption>
              <thead>
                <tr className="border-b border-gray-800">
                  {COMPARE.headers.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="text-left py-3 px-3 font-medium text-gray-400 first:sticky first:left-0 first:bg-black"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.rows.map((row) => (
                  <tr key={row[0]} className="border-b border-gray-800/80 hover:bg-gray-900/40 transition-colors">
                    {row.map((cell, i) => (
                      <td
                        key={`${row[0]}-${i}`}
                        className={
                          i === 0
                            ? "py-3.5 px-3 text-gray-300 font-medium sticky left-0 bg-black"
                            : i === 3
                              ? "py-3.5 px-3 text-white"
                              : "py-3.5 px-3 text-gray-500"
                        }
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <div className="mt-10 flex justify-center">
          <StartFreeButton size="lg" label={LANDING_CTAS.switchToBloggr} />
        </div>
      </div>
    </section>
  );
}

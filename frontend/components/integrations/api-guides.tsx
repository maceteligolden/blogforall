"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { API_LEARN_HREF } from "@/lib/integrations/api-learn-topics";
import {
  API_GUIDE_ENDPOINTS,
  ENV_SNIPPET,
  HTML_PROXY_SNIPPET,
  HTML_TAGS_SNIPPET,
  NODE_FETCH_SNIPPET,
  NODE_PROXY_SNIPPET,
  PYTHON_FETCH_SNIPPET,
  PYTHON_PROXY_SNIPPET,
  REACT_COMPONENTS_SNIPPET,
  REACT_HOOK_SNIPPET,
} from "@/lib/integrations/api-guide-snippets";
import { GuideCodeBlock } from "./guide-code-block";
import { DeveloperDocsBanner } from "@/components/settings/developer-docs-banner";

const LANGUAGES = [
  { id: "html", label: "HTML" },
  { id: "react", label: "React" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
] as const;

type LanguageId = (typeof LANGUAGES)[number]["id"];

function LearnMore({ slug, children }: { slug: Parameters<typeof API_LEARN_HREF>[0]; children: string }) {
  return (
    <Link href={API_LEARN_HREF(slug)} className="text-sm text-primary hover:underline">
      {children}
    </Link>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-sm font-semibold text-primary">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="mt-1 text-sm text-gray-400">{children}</div>
      </div>
    </div>
  );
}

export function ApiGuides({ onCreateKey }: { onCreateKey: () => void }) {
  const [language, setLanguage] = useState<LanguageId>("node");

  return (
    <div className="space-y-6">
      <DeveloperDocsBanner />

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-medium text-white">Setup</h2>
        <div className="mt-4 space-y-4">
          <Step n={1} title="Create a key">
            <p>
              Use the Keys tab or{" "}
              <button type="button" className="text-primary hover:underline" onClick={onCreateKey}>
                create a key
              </button>{" "}
              for this workspace.
            </p>
          </Step>
          <Step n={2} title="Store credentials on the server">
            <p>
              Put the values in environment variables. Never commit the secret or ship it to the browser.{" "}
              <LearnMore slug="cors">Why the browser cannot call Bloggr</LearnMore>
            </p>
            <div className="mt-3">
              <GuideCodeBlock code={ENV_SNIPPET} />
            </div>
          </Step>
          <Step n={3} title="Fetch published posts">
            <p>
              Call <code className="text-gray-200">GET /api/v1/public/blogs</code> with{" "}
              <code className="text-gray-200">x-access-key-id</code> and{" "}
              <code className="text-gray-200">x-secret-key</code>. The workspace comes from the key — do not pass{" "}
              <code className="text-gray-200">site_id</code>. <LearnMore slug="pagination">Pagination</LearnMore>
              {" · "}
              <LearnMore slug="categories">Categories</LearnMore>
              {" · "}
              <LearnMore slug="errors">Errors</LearnMore>
            </p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              {API_GUIDE_ENDPOINTS.map((item) => (
                <li key={item.path}>
                  <span className="font-mono text-green-400">{item.method}</span>{" "}
                  <span className="font-mono text-gray-300">/api/v1{item.path}</span>
                  <span className="ml-2">{item.description}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step n={4} title="Render on your site">
            <p>
              HTML and React samples below assume your own <code className="text-gray-200">/api/posts</code> proxy
              already returned JSON. <LearnMore slug="content-types">HTML vs markdown</LearnMore>
              {" · "}
              <LearnMore slug="comments">Comments</LearnMore>
              {" · "}
              <LearnMore slug="webhooks">Webhooks</LearnMore>
              {" · "}
              <LearnMore slug="rate-limits">Rate limits</LearnMore>
            </p>
          </Step>
        </div>
      </div>

      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-gray-800">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLanguage(item.id)}
              className={cn(
                "shrink-0 px-4 pb-3 text-sm font-medium transition-colors",
                language === item.id ? "border-b-2 border-primary text-primary" : "text-gray-400 hover:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-5">
          {language === "html" ? <HtmlGuide /> : null}
          {language === "react" ? <ReactGuide /> : null}
          {language === "node" ? <NodeGuide /> : null}
          {language === "python" ? <PythonGuide /> : null}
        </div>
      </div>
    </div>
  );
}

function ClientWarning() {
  return (
    <div className="rounded-lg border border-amber-800 bg-amber-900/20 p-4 text-sm text-amber-100">
      Do not put your secret in this page or in client JavaScript. Browser calls to Bloggr are blocked by CORS. Fetch
      from your own <code className="text-amber-50">/api/posts</code> route instead.{" "}
      <LearnMore slug="cors">Learn more</LearnMore>
    </div>
  );
}

function HtmlGuide() {
  return (
    <>
      <ClientWarning />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Sample tags</h3>
        <p className="text-sm text-gray-400">
          Use these on a list page and a post page after your server has the data.
        </p>
        <GuideCodeBlock code={HTML_TAGS_SNIPPET} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Load from your proxy</h3>
        <GuideCodeBlock code={HTML_PROXY_SNIPPET} />
      </section>
    </>
  );
}

function ReactGuide() {
  return (
    <>
      <ClientWarning />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Components</h3>
        <p className="text-sm text-gray-400">
          Presentational pieces. Sanitize HTML before using dangerouslySetInnerHTML.
        </p>
        <GuideCodeBlock code={REACT_COMPONENTS_SNIPPET} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">usePosts hook</h3>
        <p className="text-sm text-gray-400">Calls your origin, not Bloggr.</p>
        <GuideCodeBlock code={REACT_HOOK_SNIPPET} />
      </section>
    </>
  );
}

function NodeGuide() {
  return (
    <>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Authenticated fetch</h3>
        <GuideCodeBlock code={NODE_FETCH_SNIPPET} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Same-origin proxy</h3>
        <p className="text-sm text-gray-400">Your HTML or React app should call these routes.</p>
        <GuideCodeBlock code={NODE_PROXY_SNIPPET} />
      </section>
    </>
  );
}

function PythonGuide() {
  return (
    <>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Authenticated fetch</h3>
        <GuideCodeBlock code={PYTHON_FETCH_SNIPPET} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Same-origin proxy</h3>
        <p className="text-sm text-gray-400">Your HTML or React app should call these routes.</p>
        <GuideCodeBlock code={PYTHON_PROXY_SNIPPET} />
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { API_LEARN_TOPICS, isApiLearnSlug } from "@/lib/integrations/api-learn-topics";

export function generateStaticParams() {
  return Object.keys(API_LEARN_TOPICS).map((slug) => ({ slug }));
}

export default async function ApiLearnTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isApiLearnSlug(slug)) notFound();

  const topic = API_LEARN_TOPICS[slug];

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-xs uppercase tracking-wide text-primary">Docs coming soon</p>
        <h1 className="mt-3 text-4xl font-bold">{topic.title}</h1>
        <p className="mt-4 text-lg text-gray-400">{topic.summary}</p>
        <p className="mt-6 text-sm text-gray-500">
          This page is a placeholder. The in-app integration guides cover the basics; a full article will land here
          later.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard/integrations/api?tab=guides"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
          >
            Back to API guides
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-10 items-center rounded-md border border-gray-700 px-4 text-sm font-medium text-gray-200 hover:bg-gray-900"
          >
            Public API docs
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

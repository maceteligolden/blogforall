import {
  deriveFramerPublishValues,
  framerMappedFieldValues,
  slugifyBlogTitle,
} from "../../../../modules/integrations/services/framer-publish-payload";

describe("slugifyBlogTitle", () => {
  it("matches BlogService slug rules", () => {
    expect(slugifyBlogTitle("Hello, World!  --  Test")).toBe("hello-world-test");
  });
});

describe("deriveFramerPublishValues", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("uses existing slug, excerpt, date, and featured image", () => {
    const publishedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(
      deriveFramerPublishValues(
        {
          slug: "kept-slug",
          title: "A Title",
          content: "<p>Body</p>",
          excerpt: "Kept excerpt",
          featured_image: "https://cdn.example/cover.jpg",
          published_at: publishedAt,
        },
        now
      )
    ).toEqual({
      slug: "kept-slug",
      title: "A Title",
      content: "<p>Body</p>",
      excerpt: "Kept excerpt",
      featuredImage: "https://cdn.example/cover.jpg",
      publishedAt,
    });
  });

  it("slugifies the title when slug is missing", () => {
    const values = deriveFramerPublishValues({ title: "My New Post!", content: "<p>Hi</p>" }, now);
    expect(values.slug).toBe("my-new-post");
  });

  it("derives excerpt from HTML content when excerpt is empty", () => {
    const values = deriveFramerPublishValues(
      {
        title: "Post",
        slug: "post",
        content: "<p>First sentence of the article.</p>",
        excerpt: "   ",
      },
      now
    );
    expect(values.excerpt).toBe("First sentence of the article.");
  });

  it("truncates a long derived excerpt", () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const values = deriveFramerPublishValues({ title: "Post", slug: "post", content: `<p>${words}</p>` }, now);
    expect(values.excerpt).toBeDefined();
    expect(values.excerpt!.length).toBeLessThanOrEqual(500);
    expect(values.excerpt!.endsWith("…")).toBe(true);
  });

  it("uses now when published_at is missing", () => {
    const values = deriveFramerPublishValues({ title: "Post", content: "<p>Hi</p>" }, now);
    expect(values.publishedAt).toBe(now);
  });

  it("leaves featured image empty when the blog has none", () => {
    const values = deriveFramerPublishValues({ title: "Post", content: "<p>Hi</p>" }, now);
    expect(values.featuredImage).toBeUndefined();
  });
});

describe("framerMappedFieldValues", () => {
  it("includes slug in the mapped field list", () => {
    const publishedAt = new Date("2026-08-23T12:00:00.000Z");
    const mapped = framerMappedFieldValues({
      slug: "my-slug",
      title: "Title",
      content: "<p>Body</p>",
      excerpt: "Excerpt",
      featuredImage: "https://cdn.example/cover.jpg",
      publishedAt,
    });

    expect(mapped.map(([field]) => field)).toEqual([
      "title",
      "content",
      "slug",
      "excerpt",
      "featured_image",
      "published_at",
    ]);
    expect(mapped.find(([field]) => field === "slug")?.[1]).toBe("my-slug");
    expect(mapped.find(([field]) => field === "published_at")?.[1]).toBe(publishedAt.toISOString());
  });
});

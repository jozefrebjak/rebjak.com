import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { generateOgImage } from "../../../lib/og";

export const getStaticPaths = (async () => {
  const posts = await getCollection("blogSk", ({ data }) => !data.draft || import.meta.env.DEV);
  return posts.map((post) => ({
    params: { slug: post.id.replace(/\.md$/, "") },
    props: {
      title: post.data.title,
      date: post.data.pubDate.toLocaleDateString("sk-SK", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      tags: post.data.tags,
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { title, date, tags } = props as { title: string; date: string; tags: string[] };
  const png = await generateOgImage({ title, date, tags });
  return new Response(png, {
    headers: { "Content-Type": "image/png" },
  });
};

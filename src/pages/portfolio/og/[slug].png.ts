import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { generateOgImage } from "../../../lib/og";

export const getStaticPaths = (async () => {
  const projects = await getCollection("portfolioSk");
  return projects.map((project) => ({
    params: { slug: project.id.replace(/\.md$/, "") },
    props: {
      title: project.data.title,
      tags: project.data.tags,
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { title, tags } = props as { title: string; tags: string[] };
  const png = await generateOgImage({ title, tags });
  return new Response(png, {
    headers: { "Content-Type": "image/png" },
  });
};

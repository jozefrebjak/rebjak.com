import type { APIRoute } from "astro";
import { generateOgImage } from "../lib/og";

export const GET: APIRoute = async () => {
  const png = await generateOgImage({
    title: "Jozef Rebjak",
    tags: ["DevOps", "Automation", "Linux"],
  });
  return new Response(png, {
    headers: { "Content-Type": "image/png" },
  });
};

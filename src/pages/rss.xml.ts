import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blogSk', ({ data }) => !data.draft || import.meta.env.DEV);
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'rebjak.com — blog',
    description: 'Jozef Rebjak — developer, builder.',
    site: context.site!,
    items: posts.map((post) => {
      const slug = post.id.replace(/\.md$/, "");
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `/blog/${slug}/`,
        customData: `<enclosure url="${new URL(`/blog/og/${slug}.png`, context.site!).href}" type="image/png" length="0" />`,
      };
    }),
  });
}

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogSchema = z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
});

const blogSk = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/sk/blog' }),
    schema: blogSchema,
});

const blogEn = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/en/blog' }),
    schema: blogSchema,
});

export const collections = { blogSk, blogEn };

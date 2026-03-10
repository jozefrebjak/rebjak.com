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

const portfolioSchema = z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    url: z.string().optional(),
    source: z.string().optional(),
    order: z.number().default(0),
});

const portfolioSk = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/sk/portfolio' }),
    schema: portfolioSchema,
});

const portfolioEn = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/en/portfolio' }),
    schema: portfolioSchema,
});

export const collections = { blogSk, blogEn, portfolioSk, portfolioEn };

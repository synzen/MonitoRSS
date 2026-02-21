import type { FastifyRequest, FastifyReply } from "fastify";
import type { GetCuratedFeedsResponse } from "./curated-feeds.schemas";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedResponse: GetCuratedFeedsResponse | null = null;
let cachedAt = 0;

export async function getCuratedFeedsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const now = Date.now();

  if (!cachedResponse || now - cachedAt > CACHE_TTL_MS) {
    const { curatedFeedRepository, curatedCategoryRepository } =
      request.container;

    const [feeds, categories] = await Promise.all([
      curatedFeedRepository.getAll(),
      curatedCategoryRepository.getAll(),
    ]);

    cachedResponse = {
      result: {
        categories: categories.map((c) => ({
          id: c.categoryId,
          label: c.label,
        })),
        feeds: feeds.map((f) => {
          const feed: GetCuratedFeedsResponse["result"]["feeds"][number] = {
            url: f.url,
            title: f.title,
            category: f.category,
            domain: f.domain,
            description: f.description,
          };
          if (f.popular) {
            feed.popular = true;
          }
          return feed;
        }),
      },
    };
    cachedAt = now;
  }

  reply.header(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=600",
  );

  return reply.send(cachedResponse);
}

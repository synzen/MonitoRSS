import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  GetCuratedFeedsQuery,
  GetCuratedFeedsResponse,
  PreviewCuratedFeedParams,
} from "./curated-feeds.schemas";
import { MAX_CURATED_FEEDS_LIMIT } from "./curated-feeds.schemas";
import {
  BadRequestError,
  NotFoundError,
  ApiErrorCode,
} from "../../infra/error-handler";
import type { ICuratedFeed } from "../../repositories/interfaces/curated-feed.types";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedDefaultResponse: GetCuratedFeedsResponse | null = null;
let cachedDefaultAt = 0;

export function clearCuratedFeedsCache(): void {
  cachedDefaultResponse = null;
  cachedDefaultAt = 0;
}

function toResponseFeed(
  f: ICuratedFeed,
): GetCuratedFeedsResponse["result"]["feeds"][number] {
  const feed: GetCuratedFeedsResponse["result"]["feeds"][number] = {
    id: f.id,
    title: f.title,
    category: f.category,
    domain: f.domain,
    description: f.description,
  };
  if (f.popular) {
    feed.popular = true;
  }
  return feed;
}

export async function getCuratedFeedsHandler(
  request: FastifyRequest<{ Querystring: GetCuratedFeedsQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { q, category, limit } = request.query;

  if (q && category) {
    throw new BadRequestError(
      ApiErrorCode.INVALID_REQUEST,
      "Provide either 'q' or 'category', not both",
    );
  }

  const effectiveLimit = limit ?? MAX_CURATED_FEEDS_LIMIT;
  const { curatedFeedRepository, curatedCategoryRepository } =
    request.container;

  // Default mode (no q, no category): popular feeds, cached.
  if (!q && !category) {
    const now = Date.now();

    if (
      !cachedDefaultResponse ||
      now - cachedDefaultAt > CACHE_TTL_MS ||
      // Cap-aware: cache key is implicit on MAX_CURATED_FEEDS_LIMIT; bypass if a
      // smaller limit was requested so the cached larger payload is not reused.
      effectiveLimit !== MAX_CURATED_FEEDS_LIMIT
    ) {
      const [feeds, categories] = await Promise.all([
        curatedFeedRepository.findActivePopular(effectiveLimit),
        curatedCategoryRepository.getAll(),
      ]);

      const response: GetCuratedFeedsResponse = {
        result: {
          categories: categories.map((c) => ({
            id: c.categoryId,
            label: c.label,
          })),
          feeds: feeds.map(toResponseFeed),
        },
      };

      if (effectiveLimit === MAX_CURATED_FEEDS_LIMIT) {
        cachedDefaultResponse = response;
        cachedDefaultAt = now;
      }

      reply.header(
        "Cache-Control",
        "public, max-age=300, stale-while-revalidate=600",
      );
      return reply.send(response);
    }

    reply.header(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=600",
    );
    return reply.send(cachedDefaultResponse);
  }

  // Drill-down or search modes do not use the cached response.
  const [feeds, categories] = await Promise.all([
    q
      ? curatedFeedRepository.searchActive(q, effectiveLimit)
      : curatedFeedRepository.findActiveByCategory(category!, effectiveLimit),
    curatedCategoryRepository.getAll(),
  ]);

  const response: GetCuratedFeedsResponse = {
    result: {
      categories: categories.map((c) => ({
        id: c.categoryId,
        label: c.label,
      })),
      feeds: feeds.map(toResponseFeed),
    },
  };

  return reply.send(response);
}

export async function previewCuratedFeedHandler(
  request: FastifyRequest<{ Params: PreviewCuratedFeedParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { curatedFeedRepository, userFeedsService } = request.container;
  const { discordUserId } = request;
  const { id } = request.params;

  const curated = await curatedFeedRepository.findActiveById(id);

  if (!curated) {
    throw new NotFoundError(ApiErrorCode.CURATED_FEED_NOT_FOUND);
  }

  const result = await userFeedsService.previewFeedByUrl(
    { discordUserId },
    { url: curated.url },
  );

  return reply.status(200).send({ result });
}

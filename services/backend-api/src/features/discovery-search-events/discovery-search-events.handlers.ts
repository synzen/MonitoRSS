import type { FastifyRequest, FastifyReply } from "fastify";
import type { CreateDiscoverySearchEventBody } from "./discovery-search-events.schemas";

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

export async function createDiscoverySearchEventHandler(
  request: FastifyRequest<{ Body: CreateDiscoverySearchEventBody }>,
  reply: FastifyReply,
): Promise<void> {
  if (isRateLimited(request.discordUserId)) {
    return reply.status(429).send();
  }

  const searchTerm = request.body.searchTerm.trim().toLowerCase();

  if (searchTerm.length === 0 || searchTerm.length > 100) {
    return reply.status(400).send();
  }

  const { discoverySearchEventRepository } = request.container;

  await discoverySearchEventRepository.create({
    searchTerm,
    resultCount: request.body.resultCount,
    createdAt: new Date(),
  });

  return reply.status(204).send();
}

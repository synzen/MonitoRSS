import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Convert Fastify request to Web API Request.
 * Preserves headers, body, URL, and adds params support.
 */
export function toWebRequest(fastifyRequest: FastifyRequest): Request {
  const url = `http://${fastifyRequest.hostname}${fastifyRequest.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(fastifyRequest.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0]! : value);
  }

  const init: RequestInit = {
    method: fastifyRequest.method,
    headers,
  };

  // For methods with body, include raw body as JSON string
  if (
    ["POST", "PUT", "PATCH"].includes(fastifyRequest.method) &&
    fastifyRequest.body
  ) {
    init.body = JSON.stringify(fastifyRequest.body);
  }

  const webRequest = new Request(url, init);

  // Attach params for route parameter access (req.params.feedId pattern)
  (webRequest as Request & { params: unknown }).params =
    fastifyRequest.params || {};

  return webRequest;
}

/**
 * Convert Web API Response to Fastify reply.
 */
export async function fromWebResponse(
  webResponse: Response,
  reply: FastifyReply
): Promise<void> {
  const body = await webResponse.json();
  reply.status(webResponse.status).send(body);
}

/**
 * Wrap a Web API handler for use with Fastify.
 * Handler signature: (req: Request) => Promise<Response>
 */
export function adaptHandler(
  handler: (req: Request) => Promise<Response>
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const webRequest = toWebRequest(request);
    const webResponse = await handler(webRequest);
    await fromWebResponse(webResponse, reply);
  };
}

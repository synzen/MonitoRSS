/**
 * Discord REST Client abstraction.
 *
 * Provides an interface for Discord API operations, allowing different
 * implementations for production (using @synzen/discord-rest) and testing.
 *
 * Follows the same pattern as delivery-record-store.ts.
 */

import { randomUUID } from "crypto";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for enqueuing a message to Discord via RabbitMQ.
 */
export interface DiscordEnqueueOptions {
  method: "POST";
  body: string;
}

/**
 * Metadata for a Discord enqueue job.
 */
export interface DiscordEnqueueMeta {
  id: string;
  articleID: string;
  feedURL: string;
  feedId: string;
  guildId: string;
  mediumId: string;
  channel?: string;
  webhookId?: string;
  emitDeliveryResult: boolean;
}

/**
 * Result from enqueuing a message.
 */
export interface DiscordEnqueueResult {
  state: "success" | "error";
  status: number;
  body: Record<string, unknown>;
  message?: string;
}

/**
 * Options for a synchronous Discord API request.
 */
export interface DiscordApiRequestOptions {
  method: "POST";
  body: object;
}

/**
 * Response from a synchronous Discord API request.
 */
export interface DiscordApiResponse {
  success: boolean;
  status: number;
  body: Record<string, unknown>;
  detail?: string;
}

/**
 * Captured payload for test assertions.
 */
export interface CapturedDiscordPayload {
  type: "enqueue" | "api-request";
  url: string;
  options: DiscordEnqueueOptions | DiscordApiRequestOptions;
  meta?: DiscordEnqueueMeta;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Interface for Discord REST operations.
 *
 * Abstracts the Discord API client to allow dependency injection
 * and easier testing without module mocking.
 */
export interface DiscordRestClient {
  /**
   * Enqueue a message to Discord via RabbitMQ producer.
   * Used for async message delivery where we don't need the response immediately.
   */
  enqueue(
    url: string,
    options: DiscordEnqueueOptions,
    meta: DiscordEnqueueMeta
  ): Promise<DiscordEnqueueResult>;

  /**
   * Send a synchronous request to the Discord API.
   * Used for operations where we need the response before continuing
   * (e.g., forum thread creation to get the thread ID).
   */
  sendApiRequest(
    url: string,
    options: DiscordApiRequestOptions
  ): Promise<DiscordApiResponse>;
}

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Test implementation of DiscordRestClient that captures payloads for assertions.
 *
 * Each test can create its own instance with isolated captured payloads,
 * enabling parallel test execution.
 */
export interface TestDiscordRestClient extends DiscordRestClient {
  /**
   * All captured payloads from enqueue and sendApiRequest calls.
   */
  capturedPayloads: CapturedDiscordPayload[];

  /**
   * Clear all captured payloads.
   */
  clear(): void;

  /**
   * Configure the response for the next enqueue call.
   */
  setEnqueueResponse(response: Partial<DiscordEnqueueResult>): void;

  /**
   * Configure the response for the next API request call.
   */
  setApiResponse(response: Partial<DiscordApiResponse>): void;
}

/**
 * Create a test Discord REST client that captures payloads for assertions.
 *
 * Example usage:
 * ```typescript
 * const discordClient = createTestDiscordRestClient();
 *
 * await handleFeedV2Event(event, { ...stores, discordClient });
 *
 * expect(discordClient.capturedPayloads).toHaveLength(1);
 * expect(discordClient.capturedPayloads[0].url).toContain("/channels/");
 * ```
 */
export function createTestDiscordRestClient(): TestDiscordRestClient {
  const capturedPayloads: CapturedDiscordPayload[] = [];

  let nextEnqueueResponse: Partial<DiscordEnqueueResult> = {};
  let nextApiResponse: Partial<DiscordApiResponse> = {};

  return {
    capturedPayloads,

    clear() {
      capturedPayloads.length = 0;
      nextEnqueueResponse = {};
      nextApiResponse = {};
    },

    setEnqueueResponse(response: Partial<DiscordEnqueueResult>) {
      nextEnqueueResponse = response;
    },

    setApiResponse(response: Partial<DiscordApiResponse>) {
      nextApiResponse = response;
    },

    async enqueue(
      url: string,
      options: DiscordEnqueueOptions,
      meta: DiscordEnqueueMeta
    ): Promise<DiscordEnqueueResult> {
      capturedPayloads.push({
        type: "enqueue",
        url,
        options,
        meta,
      });

      const response: DiscordEnqueueResult = {
        state: "success",
        status: 200,
        body: { id: randomUUID() },
        ...nextEnqueueResponse,
      };

      // Reset for next call
      nextEnqueueResponse = {};

      return response;
    },

    async sendApiRequest(
      url: string,
      options: DiscordApiRequestOptions
    ): Promise<DiscordApiResponse> {
      capturedPayloads.push({
        type: "api-request",
        url,
        options,
      });

      const response: DiscordApiResponse = {
        success: true,
        status: 201,
        body: { id: randomUUID() },
        ...nextApiResponse,
      };

      // Reset for next call
      nextApiResponse = {};

      return response;
    },
  };
}

// ============================================================================
// In-Memory Implementation (alias for test client)
// ============================================================================

/**
 * Create an in-memory Discord REST client.
 * Alias for createTestDiscordRestClient for consistency with other stores.
 */
export const createInMemoryDiscordRestClient = createTestDiscordRestClient;

/**
 * Default in-memory Discord REST client singleton.
 * Useful for simple cases, but prefer creating instances for test isolation.
 */
export const inMemoryDiscordRestClient = createTestDiscordRestClient();

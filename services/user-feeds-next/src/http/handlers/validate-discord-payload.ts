/**
 * Handler for POST /v1/user-feeds/validate-discord-payload
 * Validates Discord payload using Zod schema.
 */

import { discordMediumPayloadDetailsSchema } from "../../schemas/feed-v2-event.schema";
import { withAuth } from "../middleware";
import { jsonResponse, parseJsonBody } from "../utils";

interface ValidationError {
  path: (string | number)[];
  message: string;
}

type ValidateDiscordPayloadOutput =
  | { valid: true; data: Record<string, unknown> }
  | { valid: false; errors: ValidationError[] };

export async function handleValidateDiscordPayload(
  req: Request
): Promise<Response> {
  return withAuth(req, async () => {
    const payload = await parseJsonBody<Record<string, unknown>>(req);

    // Match user-feeds behavior: pick componentsV2 from payload.data
    const result = discordMediumPayloadDetailsSchema
      .pick({
        componentsV2: true,
      })
      .safeParse((payload.data as Record<string, unknown>) ?? {});

    if (result.success) {
      const output: ValidateDiscordPayloadOutput = {
        valid: true,
        data: result.data as Record<string, unknown>,
      };
      return jsonResponse(output);
    }

    const output: ValidateDiscordPayloadOutput = {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.filter((p): p is string | number => typeof p !== "symbol"),
        message: issue.message,
      })),
    };
    return jsonResponse(output);
  });
}

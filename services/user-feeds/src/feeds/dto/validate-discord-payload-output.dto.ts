export interface ValidationError {
  path: (string | number)[];
  message: string;
}

export type ValidateDiscordPayloadOutputDto =
  | { valid: true; data: Record<string, unknown> }
  | { valid: false; errors: ValidationError[] };

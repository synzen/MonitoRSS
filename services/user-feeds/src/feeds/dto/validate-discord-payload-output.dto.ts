export interface ValidationError {
  path: (string | number)[];
  message: string;
}

export type ValidateDiscordPayloadOutputDto =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

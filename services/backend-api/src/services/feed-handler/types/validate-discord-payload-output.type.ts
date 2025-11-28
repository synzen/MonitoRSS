export type ValidateDiscordPayloadOutput =
  | {
      valid: true;
      data: Record<string, unknown>;
    }
  | {
      valid: false;
      errors: Array<{
        path: (string | number)[];
        message: string;
      }>;
    };

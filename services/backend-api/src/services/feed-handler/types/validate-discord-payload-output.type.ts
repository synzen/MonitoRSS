export interface ValidateDiscordPayloadOutput {
  valid: boolean;
  errors?: Array<{
    path: (string | number)[];
    message: string;
  }>;
}

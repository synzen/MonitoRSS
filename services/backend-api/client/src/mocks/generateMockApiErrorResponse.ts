import { StandardApiErrorResponse } from "@/types/StandardApiErrorResponse";

export const generateMockApiErrorResponse = (
  override?: Partial<StandardApiErrorResponse>,
): StandardApiErrorResponse => ({
  isStandardized: true,
  code: "UNKNOWN_ERROR",
  message: "Unknown error",
  errors: [],
  timestamp: new Date().getTime() / 1000,
  ...override,
});

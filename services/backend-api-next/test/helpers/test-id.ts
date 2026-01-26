import mongoose from "mongoose";

export function generateTestId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

export function isValidTestId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

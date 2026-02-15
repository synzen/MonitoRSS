import mongoose from "mongoose";
import { randomInt } from "node:crypto";

export function generateTestId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

export function isValidTestId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export function generateSnowflake(): string {
  const first = randomInt(1, 10).toString();
  let rest = "";
  for (let i = 0; i < 17; i++) {
    rest += randomInt(0, 10).toString();
  }
  return first + rest;
}

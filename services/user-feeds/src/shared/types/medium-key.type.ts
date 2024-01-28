import { z } from "zod";

export enum MediumKey {
  Discord = "discord",
}

export const mediumKeySchema = z.nativeEnum(MediumKey);

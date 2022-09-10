import { string } from "yup";

export enum MediumKey {
  Discord = "discord",
}

export const mediumKeySchema = string()
  .oneOf(Object.values(MediumKey))
  .required();

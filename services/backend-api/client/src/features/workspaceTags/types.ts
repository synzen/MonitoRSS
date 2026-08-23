import { InferType, mixed, object, string } from "yup";

export const WORKSPACE_TAG_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;

export type WorkspaceTagColor = (typeof WORKSPACE_TAG_COLORS)[number];

export const WorkspaceTagSchema = object({
  id: string().required(),
  name: string().required(),
  color: mixed<WorkspaceTagColor>()
    .oneOf([...WORKSPACE_TAG_COLORS])
    .optional(),
});

export type WorkspaceTag = InferType<typeof WorkspaceTagSchema>;

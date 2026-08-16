import { InferType, number, object } from "yup";
import fetchRest from "@/utils/fetchRest";

const MovePersonalFeedsToWorkspaceOutputSchema = object({
  result: object({
    movedCount: number().required(),
  }).required(),
}).required();

export type MovePersonalFeedsToWorkspaceOutput = InferType<
  typeof MovePersonalFeedsToWorkspaceOutputSchema
>;

export const movePersonalFeedsToWorkspace = async ({
  workspaceSlug,
  feedIds,
}: {
  workspaceSlug: string;
  feedIds: string[];
}): Promise<MovePersonalFeedsToWorkspaceOutput> => {
  const response = await fetchRest(`/api/v1/workspaces/${workspaceSlug}/personal-feed-moves`, {
    validateSchema: MovePersonalFeedsToWorkspaceOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify({ feedIds }),
    },
  });

  return response as MovePersonalFeedsToWorkspaceOutput;
};

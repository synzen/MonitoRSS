import fetchRest from "@/utils/fetchRest";

export interface RevertEmailVerificationInput {
  details: {
    token: string;
  };
}

export const revertEmailVerification = async ({
  details,
}: RevertEmailVerificationInput): Promise<void> => {
  await fetchRest("/api/v1/users/@me/email-verification/revert", {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(details),
    },
  });
};

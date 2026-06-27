import fetchRest from "@/utils/fetchRest";

export interface ConfirmEmailVerificationInput {
  details: {
    email: string;
    code: string;
  };
}

export const confirmEmailVerification = async ({
  details,
}: ConfirmEmailVerificationInput): Promise<void> => {
  await fetchRest("/api/v1/users/@me/email-verification/confirm", {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(details),
    },
  });
};

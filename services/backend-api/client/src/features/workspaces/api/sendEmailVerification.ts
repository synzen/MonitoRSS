import fetchRest from "@/utils/fetchRest";

export interface SendEmailVerificationInput {
  details: {
    email: string;
  };
}

export const sendEmailVerification = async ({
  details,
}: SendEmailVerificationInput): Promise<void> => {
  await fetchRest("/api/v1/users/@me/email-verification", {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(details),
    },
  });
};

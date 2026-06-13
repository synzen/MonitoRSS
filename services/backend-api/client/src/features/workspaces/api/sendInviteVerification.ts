import fetchRest from "@/utils/fetchRest";

export interface SendInviteVerificationInput {
  inviteId: string;
  details: {
    email: string;
  };
}

// Invite-scoped verification send. The server dispatches a code only when the
// submitted address matches the invited address (uniform response either way),
// so the invite flow can never email an unrelated address.
export const sendInviteVerification = async ({
  inviteId,
  details,
}: SendInviteVerificationInput): Promise<void> => {
  await fetchRest(`/api/v1/workspace-invites/${inviteId}/verification`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(details),
    },
  });
};

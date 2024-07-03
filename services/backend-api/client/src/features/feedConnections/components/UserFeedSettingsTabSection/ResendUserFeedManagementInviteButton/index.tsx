import { IconButton } from "@chakra-ui/react";
import { FiSend } from "react-icons/fi";
import { useCreateUserFeedManagementInviteResend } from "../../../../feed/hooks";
import { notifySuccess } from "@/utils/notifySuccess";
import { ConfirmModal } from "../../../../../components";

interface Props {
  feedId: string;
  inviteId: string;
}

export const ResendUserFeedManagementInviteButton = ({ feedId, inviteId }: Props) => {
  const { mutateAsync, status, error, reset } = useCreateUserFeedManagementInviteResend({ feedId });

  const onClick = async () => {
    await mutateAsync({
      id: inviteId,
    });

    notifySuccess("Invite has been re-sent!");
  };

  return (
    <ConfirmModal
      trigger={
        <IconButton
          size="md"
          title="Resend invite"
          variant="link"
          icon={<FiSend />}
          aria-label="Resend invite"
          isLoading={status === "loading"}
          onClick={onClick}
        />
      }
      title="Resend Invite"
      description="Are you sure you want to resend this invite?"
      onConfirm={onClick}
      colorScheme="blue"
      onClosed={reset}
      error={error?.message}
    />
  );
};

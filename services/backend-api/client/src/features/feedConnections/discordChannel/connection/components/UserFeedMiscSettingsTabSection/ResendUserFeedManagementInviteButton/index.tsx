import { FiSend } from "react-icons/fi";
import { useCreateUserFeedManagementInviteResend } from "@/features/feed";
import { ConfirmModal } from "@/components";
import { SafeLoadingIconButton } from "@/components/SafeLoadingIconButton";
import { usePageAlertContext } from "@/contexts/PageAlertContext";

interface Props {
  feedId: string;
  inviteId: string;
}

export const ResendUserFeedManagementInviteButton = ({ feedId, inviteId }: Props) => {
  const { mutateAsync, status, error, reset } = useCreateUserFeedManagementInviteResend({ feedId });
  const { createSuccessAlert } = usePageAlertContext();

  const onClick = async () => {
    await mutateAsync({
      id: inviteId,
    });

    createSuccessAlert({
      title: "Successfully re-sent feed management invite",
    });
  };

  return (
    <ConfirmModal
      trigger={
        <SafeLoadingIconButton
          size="md"
          title="Resend invite"
          variant="ghost"
          aria-label="Resend invite"
          loading={status === "loading"}
          onClick={onClick}
        >
          <FiSend />
        </SafeLoadingIconButton>
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

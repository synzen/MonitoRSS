import { IconButton } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiSend } from "react-icons/fi";
import { useCreateUserFeedManagementInviteResend } from "../../../../feed/hooks";
import { notifyError } from "@/utils/notifyError";
import { notifySuccess } from "@/utils/notifySuccess";
import { ConfirmModal } from "../../../../../components";

interface Props {
  feedId: string;
  inviteId: string;
}

export const ResendUserFeedManagementInviteButton = ({ feedId, inviteId }: Props) => {
  const { mutateAsync, status } = useCreateUserFeedManagementInviteResend({ feedId });
  const { t } = useTranslation();

  const onClick = async () => {
    try {
      await mutateAsync({
        id: inviteId,
      });

      notifySuccess("Invite has been re-sent!");
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), (err as Error).message);
    }
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
    />
  );
};

import { Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { notifyError } from "@/utils/notifyError";
import { notifySuccess } from "@/utils/notifySuccess";
import { useRefreshUserFeed } from "../../hooks";

interface Props {
  feedId: string;
}

export const RefreshUserFeedButton: React.FC<Props> = ({ feedId }) => {
  const { t } = useTranslation();
  const { mutateAsync, status } = useRefreshUserFeed();

  const onRefreshFeed = async () => {
    try {
      await mutateAsync({
        feedId,
      });
      notifySuccess(t("features.feed.components.refreshButton.success"));
    } catch (err) {
      notifyError(t("features.feed.components.refreshButton.failure"), err as Error);
    }
  };

  return (
    <Button onClick={onRefreshFeed} isLoading={status === "loading"}>
      <span>{t("features.feed.components.refreshButton.text")}</span>
    </Button>
  );
};

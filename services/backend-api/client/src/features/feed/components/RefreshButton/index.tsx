import { Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { notifyError } from "@/utils/notifyError";
import { refreshFeed } from "../..";
import { notifySuccess } from "@/utils/notifySuccess";
import { Feed } from "@/types";

interface Props {
  feedId: string;
  onSuccess: (updatedFeed: Feed) => Promise<any>;
}

export const RefreshButton: React.FC<Props> = ({ feedId, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const onRefreshFeed = async () => {
    try {
      setLoading(true);
      const response = await refreshFeed({
        feedId,
      });
      await onSuccess(response.result);
      notifySuccess(t("features.feed.components.refreshButton.success"));
    } catch (err) {
      notifyError(t("features.feed.components.refreshButton.failure"), err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={onRefreshFeed} isLoading={loading}>
      <span>{t("features.feed.components.refreshButton.text")}</span>
    </Button>
  );
};

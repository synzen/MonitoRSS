import { Button } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyError } from "@/utils/notifyError";
import { getFeedArticlesDump } from "../../api";

interface Props {
  feedId?: string;
}

export const FeedDumpButton: React.FC<Props> = ({ feedId }) => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);

  const onClick = async () => {
    if (!feedId) {
      return;
    }

    try {
      setDownloading(true);

      const blob = await getFeedArticlesDump({
        feedId,
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "raw-articles.txt");
      document.body.appendChild(link);
      link.click();
      link?.parentNode?.removeChild(link);
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button onClick={onClick} isLoading={downloading} isDisabled={downloading || !feedId}>
      <span>{t("features.feed.components.dumpButton.text")}</span>
    </Button>
  );
};

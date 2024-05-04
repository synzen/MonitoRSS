import { Button } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyError } from "@/utils/notifyError";
import { getServerBackup } from "../../api";

interface Props {
  serverId?: string;
}

export const DiscordServerBackupButton: React.FC<Props> = ({ serverId }) => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);

  const onClick = async () => {
    if (!serverId) {
      return;
    }

    try {
      setDownloading(true);

      const blob = await getServerBackup({
        serverId,
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${serverId}-${Math.round(new Date().getTime() / 1000)}.json`);
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
    <Button onClick={onClick} isLoading={downloading} isDisabled={downloading || !serverId}>
      <span>{t("features.discordServers.components.backupButton.text")}</span>
    </Button>
  );
};

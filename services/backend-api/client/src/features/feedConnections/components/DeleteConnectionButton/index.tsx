import { DeleteIcon } from "@chakra-ui/icons";
import { Button } from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../../../../components";
import { FeedConnectionType } from "../../../../types";
import { useConnection, useDeleteConnection } from "../../hooks";
import { pages } from "@/constants";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

interface Props {
  feedId: string;
  connectionId: string;
  type: FeedConnectionType;
  trigger?: React.ReactElement;
}

export const DeleteConnectionButton = ({ feedId, connectionId, type, trigger }: Props) => {
  const { t } = useTranslation();
  const { mutateAsync, status, error, reset } = useDeleteConnection(type);
  const navigate = useNavigate();
  const { createSuccessAlert } = usePageAlertContext();
  const { connection } = useConnection({
    feedId,
    connectionId,
  });

  const onDelete = async () => {
    await mutateAsync({
      feedId,
      connectionId,
    });
    navigate(pages.userFeed(feedId));
    createSuccessAlert({
      title: `Successfully deleted feed connection: ${connection?.name}`,
    });
  };

  return (
    <ConfirmModal
      title={t("features.feedConnections.components.deleteButton.confirmTitle")}
      description={t("features.feedConnections.components.deleteButton.confirmDescription")}
      trigger={
        trigger ? (
          React.cloneElement(trigger, {
            disabled: status === "loading",
          })
        ) : (
          <Button variant="outline" isDisabled={status === "loading"} leftIcon={<DeleteIcon />}>
            {t("common.buttons.delete")}
          </Button>
        )
      }
      okText={t("pages.userFeed.deleteConfirmOk")}
      colorScheme="red"
      onConfirm={onDelete}
      error={error?.message}
      onClosed={reset}
    />
  );
};

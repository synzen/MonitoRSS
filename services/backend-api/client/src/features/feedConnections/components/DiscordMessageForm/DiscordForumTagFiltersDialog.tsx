import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { FiltersForm } from "../FiltersForm";
import { LogicalFilterExpression } from "../../types";
import { GetUserFeedArticlesInput } from "../../../feed/api";

interface Props {
  trigger: React.ReactElement;
  tagName: string;
  feedId?: string;
  filters: { expression: LogicalFilterExpression } | null;
  onFiltersUpdated: (filters: { expression: LogicalFilterExpression } | null) => Promise<void>;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const DiscordForumTagFiltersDialog = ({
  trigger,
  tagName,
  feedId,
  filters,
  onFiltersUpdated,
  articleFormatter,
}: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();

  return (
    <>
      {React.cloneElement(trigger, {
        onClick: onOpen,
      })}
      <Modal size="4xl" isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {t("components.discordMessageForumThreadForm.threadTagFiltersTitle")} ({tagName})
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody marginBottom={4}>
            <Stack spacing={4}>
              <Text>
                {t("components.discordMessageForumThreadForm.threadTagFiltersDescription")}
              </Text>
              <FiltersForm
                data={{
                  feedId,
                  articleFormatter,
                }}
                expression={filters?.expression || null}
                onSave={async (expression) => {
                  onFiltersUpdated(expression ? { expression } : null);
                  onClose();
                }}
                formContainerProps={{
                  bg: "gray.800",
                  rounded: "md",
                }}
              />
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

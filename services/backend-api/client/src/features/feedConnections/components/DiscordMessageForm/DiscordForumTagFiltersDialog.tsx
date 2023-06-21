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

interface Props {
  trigger: React.ReactElement;
  tagName: string;
  feedId?: string;
  filters: { expression: LogicalFilterExpression } | null;
  onFiltersUpdated: (filters: { expression: LogicalFilterExpression } | null) => Promise<void>;
}

export const DiscordForumTagFiltersDialog = ({
  trigger,
  tagName,
  feedId,
  filters,
  onFiltersUpdated,
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
                }}
                expression={filters?.expression || null}
                onSave={async (expression) => {
                  onFiltersUpdated(expression ? { expression } : null);
                  onClose();
                }}
              />
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

import {
  Button,
  HStack,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
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
  feedId?: string;
  filters: { expression: LogicalFilterExpression } | null;
  onFiltersUpdated: (filters: { expression: LogicalFilterExpression } | null) => Promise<void>;
  onRemoved: () => void;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const DiscordMentionSettingsDialog = ({
  trigger,
  feedId,
  filters,
  onFiltersUpdated,
  onRemoved,
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
            {t("components.discordMessageMentionForm.mentionSettingsTitle")}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody marginBottom={4}>
            <Stack spacing={8}>
              <Stack spacing={4}>
                <Heading size="md">
                  {t("components.discordMessageMentionForm.mentionFiltersTitle")}
                </Heading>
                <Text>{t("components.discordMessageMentionForm.mentionFiltersDescription")}</Text>
                <FiltersForm
                  data={{
                    feedId,
                    articleFormatter,
                  }}
                  previewTitle={
                    <Heading as="h3" size="sm">
                      Filter Results Preview
                    </Heading>
                  }
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
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack justifyContent="space-between" width="100%">
              <Button colorScheme="red" variant="outline" onClick={onRemoved}>
                {t("components.discordMessageMentionForm.removeMentionButton")}
              </Button>
              <Button onClick={onClose}>{t("common.buttons.close")}</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

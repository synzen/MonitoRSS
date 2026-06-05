import { Button, HStack, Heading, Stack, Text } from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { FiltersForm } from "../FiltersForm";
import { LogicalFilterExpression } from "../../types";

interface Props {
  trigger: React.ReactElement;
  filters: { expression: LogicalFilterExpression } | null;
  onFiltersUpdated: (filters: { expression: LogicalFilterExpression } | null) => Promise<void>;
  onRemoved: () => void;
}

export const DiscordMentionSettingsDialog = ({
  trigger,
  filters,
  onFiltersUpdated,
  onRemoved,
}: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <DialogRoot size="cover" open={open} onOpenChange={(e) => setOpen(e.open)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("components.discordMessageMentionForm.mentionSettingsTitle")}
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody marginBottom={4}>
          <Stack gap={8}>
            <Stack gap={4}>
              <Heading size="md">
                {t("components.discordMessageMentionForm.mentionFiltersTitle")}
              </Heading>
              <Text>{t("components.discordMessageMentionForm.mentionFiltersDescription")}</Text>
              <FiltersForm
                previewTitle={
                  <Heading as="h3" size="sm">
                    Filter Results Preview
                  </Heading>
                }
                expression={filters?.expression || null}
                onSave={async (expression) => {
                  onFiltersUpdated(expression ? { expression } : null);
                  setOpen(false);
                }}
                formContainerProps={{
                  bg: "bg.subtle",
                  rounded: "md",
                }}
              />
            </Stack>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <HStack justifyContent="space-between" width="100%">
            <DestructiveActionButton onClick={onRemoved}>
              {t("components.discordMessageMentionForm.removeMentionButton")}
            </DestructiveActionButton>
            <Button onClick={() => setOpen(false)}>{t("common.buttons.close")}</Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

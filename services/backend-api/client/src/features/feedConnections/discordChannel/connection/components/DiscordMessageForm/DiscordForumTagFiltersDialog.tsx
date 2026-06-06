import { Stack, Text } from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogTrigger,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { FiltersForm } from "../FiltersForm";
import { LogicalFilterExpression } from "../../types";

interface Props {
  trigger: React.ReactElement;
  tagName: string;
  filters: { expression: LogicalFilterExpression } | null;
  onFiltersUpdated: (filters: { expression: LogicalFilterExpression } | null) => Promise<void>;
}

export const DiscordForumTagFiltersDialog = ({
  trigger,
  tagName,
  filters,
  onFiltersUpdated,
}: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <DialogRoot size="cover" open={open} onOpenChange={(e) => setOpen(e.open)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("components.discordMessageForumThreadForm.threadTagFiltersTitle")} ({tagName})
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody marginBottom={4}>
          <Stack gap={4}>
            <Text>{t("components.discordMessageForumThreadForm.threadTagFiltersDescription")}</Text>
            <FiltersForm
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
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};

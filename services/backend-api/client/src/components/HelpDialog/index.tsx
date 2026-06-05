import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseTrigger,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  trigger: React.ReactElement;
  body: React.ReactNode;
  title: React.ReactNode;
}

export const HelpDialog = ({ trigger, title, body }: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <DialogRoot size="xl" open={open} onOpenChange={(e) => setOpen(e.open)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>{body}</DialogBody>
        <DialogFooter>
          <PrimaryActionButton onClick={() => setOpen(false)}>
            {t("common.buttons.close")}
          </PrimaryActionButton>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

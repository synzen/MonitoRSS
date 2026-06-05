import { Button, Stack, Text } from "@chakra-ui/react";
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
} from "@/components/ui/dialog";
import { InlineErrorAlert } from "../InlineErrorAlert";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";

interface Props {
  onConfirm: () => void;
  trigger: React.ReactElement;
  title?: string;
  error?: string;
  description?: string;
  descriptionNode?: React.ReactNode;
  cancelText?: string;
  okText?: string;
  colorScheme?: string;
  size?: string;
  onClosed?: () => void;
}

export const ConfirmModal = ({
  onConfirm,
  trigger,
  title,
  error,
  description,
  cancelText,
  okText,
  colorScheme,
  descriptionNode,
  size,
  onClosed,
}: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const onClickConfirm = async () => {
    setLoading(true);

    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogRoot
      role="alertdialog"
      open={open}
      onOpenChange={(e) => {
        setOpen(e.open);

        if (!e.open) {
          onClosed?.();
        }
      }}
      size={size as never}
      onRequestDismiss={(e) => e.preventDefault()}
      initialFocusEl={() => cancelRef.current}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {title && (
          <DialogHeader marginRight={4}>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <DialogBody>
          <Stack gap={4}>
            {description && !descriptionNode && <Text>{description}</Text>}
            {descriptionNode && !description && descriptionNode}
            {error && (
              <InlineErrorAlert title={t("common.errors.somethingWentWrong")} description={error} />
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button ref={cancelRef} variant="ghost" onClick={() => setOpen(false)}>
            <span>{cancelText || t("common.buttons.cancel")}</span>
          </Button>
          <SafeLoadingButton
            loading={loading}
            colorPalette={colorScheme}
            variant="solid"
            onClick={onClickConfirm}
          >
            <span>{okText || t("common.buttons.confirm")}</span>
          </SafeLoadingButton>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

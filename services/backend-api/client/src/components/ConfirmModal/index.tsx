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
  trigger?: React.ReactElement;
  title?: string;
  error?: string;
  description?: string;
  descriptionNode?: React.ReactNode;
  cancelText?: string;
  okText?: string;
  colorScheme?: string;
  size?: string;
  onClosed?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  open: controlledOpen,
  onOpenChange,
}: Props) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }

    onOpenChange?.(next);
  };

  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const onClickConfirm = async () => {
    setLoading(true);

    // A rejecting onConfirm keeps the modal open so the caller's `error` prop can be
    // shown; swallow the rejection here rather than let it escape as an unhandled
    // rejection (nothing awaits this click handler).
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Intentionally ignored — the failure is surfaced via the `error` prop.
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
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
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

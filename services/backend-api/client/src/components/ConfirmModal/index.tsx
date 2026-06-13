import { Button, Input, Stack, Text } from "@chakra-ui/react";
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
import { Field } from "@/components/ui/field";
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
  /**
   * When set, the confirm button stays disabled until the user types this exact
   * phrase. Use for high-impact destructive actions where a single click is too
   * easy (e.g. deleting a resource that affects other people).
   */
  confirmationPhrase?: string;
  /**
   * When true, the confirm button is disabled regardless of the confirmation
   * phrase. Use to gate confirmation on a caller-owned validity check (e.g. a
   * selection that exceeds a limit) so an invalid action is blocked client-side
   * rather than round-tripping to a server rejection.
   */
  okDisabled?: boolean;
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
  confirmationPhrase,
  okDisabled,
}: Props) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [phraseInput, setPhraseInput] = useState("");
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const phraseMismatch = !!confirmationPhrase && phraseInput.trim() !== confirmationPhrase;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }

    if (!next) {
      setPhraseInput("");
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
            {confirmationPhrase && (
              <Field label={`Type "${confirmationPhrase}" to confirm`} required>
                <Input
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            )}
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
            disabled={phraseMismatch || okDisabled}
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

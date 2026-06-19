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
import { CloseButton } from "@/components/ui/close-button";
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
  /**
   * When true, renders a top-right close button. The button is an explicit,
   * aimed exit (it calls the close path directly), so it works even though this
   * modal blocks Ark's own dismissal — backdrop clicks stay disabled (and Escape
   * too, unless `allowEscape` is set) so a reflexive interaction can't drop a
   * high-impact action mid-confirmation.
   */
  showCloseButton?: boolean;
  /**
   * When true, the modal closes the instant confirm is clicked instead of
   * staying open until `onConfirm` resolves. Use when the action reports its own
   * outcome elsewhere (e.g. a page-level alert) and the modal is purely a yes/no
   * gate — otherwise the modal (and its backdrop) sits over the page for the
   * whole request, blocking the controls beneath it. Leave false (the default)
   * when the modal surfaces failures inline via `error` and the user may retry.
   */
  closeOnConfirm?: boolean;
  /**
   * When true, the Escape key cancels the modal. Backdrop clicks stay blocked
   * either way: Escape is a deliberate keypress (so honoring it can't be a
   * misclick), whereas a backdrop click on a confirmation is ambiguous. Enable
   * for reversible actions where a quick keyboard exit is welcome; leave false
   * (the default) for irreversible ones, where every exit should be aimed.
   */
  allowEscape?: boolean;
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
  showCloseButton,
  closeOnConfirm,
  allowEscape,
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

  // The top-right close button. Backdrop dismissal is disabled (and Escape too,
  // unless opted in), so the X is an explicit exit that closes and fires onClosed
  // itself (controlled callers reset their state from it).
  const onClickClose = () => {
    setOpen(false);
    onClosed?.();
  };

  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const onClickConfirm = async () => {
    // Gate mode: dismiss now and let the action run in the background. The modal
    // reports nothing inline, so keeping it (and its backdrop) up for the whole
    // request would only block the page beneath it.
    if (closeOnConfirm) {
      setOpen(false);
      onConfirm();

      return;
    }

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
      // A confirmation must not be dismissed by a misclick on the backdrop. Escape
      // is a deliberate keypress, so it is allowed only for reversible actions
      // that opt in via `allowEscape`; otherwise every exit is an aimed click
      // (Cancel, or the optional X).
      closeOnInteractOutside={false}
      closeOnEscape={!!allowEscape}
      initialFocusEl={() => cancelRef.current}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        {showCloseButton && (
          <CloseButton size="sm" position="absolute" top="2" insetEnd="2" onClick={onClickClose} />
        )}
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

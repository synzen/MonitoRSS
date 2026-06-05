/* eslint-disable react/destructuring-assignment --
   Discriminated-union props (editor vs picker): variant-specific fields exist on only one
   union member, so they're read as props.X after a props.mode check, not destructured upfront. */
import React from "react";
import { Button, HStack } from "@chakra-ui/react";
import { DialogFooter } from "@/components/ui/dialog";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Alert } from "@/components/ui/alert";
import { useBrandingContext } from "./BrandingContext";

interface ModalFooterBaseProps {
  showTemplateError: boolean;
  saveButtonRef: React.RefObject<HTMLButtonElement>;
  onUpgrade: () => void;
  tertiaryActionLabel?: string;
  onTertiaryAction?: () => void;
}

interface ModalFooterEditorProps extends ModalFooterBaseProps {
  mode: "editor";
  onCancel: () => void;
  onSaveWithoutBranding: () => void;
  isSaveLoading?: boolean;
  onSave: () => void;
}

interface ModalFooterPickerProps extends ModalFooterBaseProps {
  mode: "picker";
  secondaryActionLabel: string;
  onSecondaryAction: () => void;
  onPrimaryActionWithoutBranding: () => void;
  onPrimaryAction: () => void;
  isPrimaryActionLoading?: boolean;
  primaryActionLabel: string;
}

export type ModalFooterActionsProps = ModalFooterEditorProps | ModalFooterPickerProps;

export const ModalFooterActions = (props: ModalFooterActionsProps) => {
  const { showTemplateError, saveButtonRef, onUpgrade, tertiaryActionLabel, onTertiaryAction } =
    props;
  const { webhooksAllowed, hasBrandingValues } = useBrandingContext();

  return (
    <DialogFooter flexDirection="column" gap={3} alignItems="stretch">
      {showTemplateError && <Alert status="error">Please select a template first.</Alert>}
      {props.mode === "editor" ? (
        <HStack w="100%" justifyContent="space-between">
          <Button
            variant="plain"
            colorPalette="gray"
            onClick={onTertiaryAction}
            color="fg.muted"
            _hover={{ color: "fg" }}
          >
            {tertiaryActionLabel}
          </Button>
          <HStack>
            <Button variant="ghost" onClick={props.onCancel}>
              Cancel
            </Button>
            {!webhooksAllowed && hasBrandingValues ? (
              <>
                <Button
                  variant="ghost"
                  onClick={props.onSaveWithoutBranding}
                  disabled={props.isSaveLoading}
                >
                  Save without branding
                </Button>
                <PrimaryActionButton onClick={onUpgrade}>
                  Upgrade to save with branding
                </PrimaryActionButton>
              </>
            ) : (
              <PrimaryActionButton
                ref={saveButtonRef}
                aria-disabled={props.isSaveLoading}
                onClick={(e) => {
                  e.preventDefault();

                  if (props.isSaveLoading) {
                    return;
                  }

                  props.onSave();
                }}
              >
                {props.isSaveLoading ? "Saving..." : "Save"}
              </PrimaryActionButton>
            )}
          </HStack>
        </HStack>
      ) : (
        <HStack w="100%" justifyContent="flex-end">
          {tertiaryActionLabel && (
            <Button
              variant="plain"
              colorPalette="gray"
              mr="auto"
              onClick={onTertiaryAction}
              color="fg.muted"
              _hover={{ color: "fg" }}
            >
              {tertiaryActionLabel}
            </Button>
          )}
          <Button variant="outline" onClick={props.onSecondaryAction}>
            {props.secondaryActionLabel}
          </Button>
          {!webhooksAllowed && hasBrandingValues ? (
            <>
              <Button variant="outline" onClick={props.onPrimaryActionWithoutBranding}>
                Save without branding
              </Button>
              <PrimaryActionButton onClick={onUpgrade}>
                Upgrade to save with branding
              </PrimaryActionButton>
            </>
          ) : (
            <PrimaryActionButton
              ref={saveButtonRef}
              loading={props.isPrimaryActionLoading}
              onClick={props.onPrimaryAction}
            >
              {props.primaryActionLabel}
            </PrimaryActionButton>
          )}
        </HStack>
      )}
    </DialogFooter>
  );
};

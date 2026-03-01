import React from "react";
import { ModalFooter, Button, Alert, AlertIcon, AlertDescription, HStack } from "@chakra-ui/react";
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
    <ModalFooter flexDirection="column" gap={3} alignItems="stretch">
      {showTemplateError && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertDescription>Please select a template first.</AlertDescription>
        </Alert>
      )}
      {props.mode === "editor" ? (
        <HStack w="100%" justifyContent="space-between">
          <Button
            variant="link"
            colorScheme="gray"
            onClick={onTertiaryAction}
            color="gray.400"
            _hover={{ color: "white" }}
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
                  isDisabled={props.isSaveLoading}
                >
                  Save without branding
                </Button>
                <Button colorScheme="blue" onClick={onUpgrade}>
                  Upgrade to save with branding
                </Button>
              </>
            ) : (
              <Button
                ref={saveButtonRef}
                colorScheme="blue"
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
              </Button>
            )}
          </HStack>
        </HStack>
      ) : (
        <HStack w="100%" justifyContent="flex-end">
          {tertiaryActionLabel && (
            <Button
              variant="link"
              colorScheme="gray"
              mr="auto"
              onClick={onTertiaryAction}
              color="gray.400"
              _hover={{ color: "white" }}
            >
              {tertiaryActionLabel}
            </Button>
          )}
          <Button variant="outline" mr={3} onClick={props.onSecondaryAction}>
            {props.secondaryActionLabel}
          </Button>
          {!webhooksAllowed && hasBrandingValues ? (
            <>
              <Button variant="outline" mr={3} onClick={props.onPrimaryActionWithoutBranding}>
                Save without branding
              </Button>
              <Button colorScheme="blue" onClick={onUpgrade}>
                Upgrade to save with branding
              </Button>
            </>
          ) : (
            <Button
              ref={saveButtonRef}
              colorScheme="blue"
              isLoading={props.isPrimaryActionLoading}
              onClick={props.onPrimaryAction}
            >
              {props.primaryActionLabel}
            </Button>
          )}
        </HStack>
      )}
    </ModalFooter>
  );
};

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
  ThemingProps,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onConfirm: () => void;
  trigger: React.ReactElement;
  title?: string;
  description?: string;
  descriptionNode?: React.ReactNode;
  cancelText?: string;
  okText?: string;
  colorScheme?: ThemingProps["colorScheme"];
  size?: ThemingProps["size"];
}

export const ConfirmModal = ({
  onConfirm,
  trigger,
  title,
  description,
  cancelText,
  okText,
  colorScheme,
  descriptionNode,
  size,
}: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const onClickConfirm = async () => {
    setLoading(true);

    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {React.cloneElement(trigger, { onClick: onOpen })}
      <AlertDialog isOpen={isOpen} onClose={onClose} size={size} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          {title && <AlertDialogHeader marginRight={4}>{title}</AlertDialogHeader>}
          {description && !descriptionNode && (
            <AlertDialogBody>
              <Text>{description}</Text>
            </AlertDialogBody>
          )}
          {descriptionNode && !description && <AlertDialogBody>{descriptionNode}</AlertDialogBody>}
          <AlertDialogFooter>
            <Button ref={cancelRef} variant="ghost" mr={3} onClick={onClose}>
              <span>{cancelText || t("common.buttons.cancel")}</span>
            </Button>
            <Button
              isLoading={loading}
              colorScheme={colorScheme}
              variant="solid"
              onClick={onClickConfirm}
            >
              <span>{okText || t("common.buttons.confirm")}</span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

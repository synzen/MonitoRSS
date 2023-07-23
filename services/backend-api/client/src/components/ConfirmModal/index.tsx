import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
  cancelText?: string;
  okText?: string;
  colorScheme?: ThemingProps["colorScheme"];
}

export const ConfirmModal = ({
  onConfirm,
  trigger,
  title,
  description,
  cancelText,
  okText,
  colorScheme,
}: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

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
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          {title && <ModalHeader marginRight={4}>{title}</ModalHeader>}
          <ModalCloseButton />
          {description && (
            <ModalBody>
              <Text>{description}</Text>
            </ModalBody>
          )}
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              {cancelText || t("common.buttons.cancel")}
            </Button>
            <Button
              isLoading={loading}
              colorScheme={colorScheme}
              variant="solid"
              onClick={onClickConfirm}
            >
              {okText || t("common.buttons.confirm")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

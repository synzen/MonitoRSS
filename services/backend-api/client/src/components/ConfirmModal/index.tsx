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
} from '@chakra-ui/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onConfirm: () => void
  trigger: React.ReactElement
  title?: string
  description?: string
  cancelText?: string
  okText?: string
  colorScheme?: ThemingProps['colorScheme']
  okLoading?: boolean
}

export const ConfirmModal = ({
  onConfirm,
  trigger,
  title,
  description,
  cancelText,
  okText,
  colorScheme,
  okLoading,
}: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { t } = useTranslation();

  const onClickConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <>
      {React.cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          {title && <ModalHeader>{title}</ModalHeader>}
          <ModalCloseButton />
          {description && (
            <ModalBody>
              <Text>{description}</Text>
            </ModalBody>
          )}
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              {cancelText || t('common.buttons.cancel')}
            </Button>
            <Button
              isLoading={okLoading}
              colorScheme={colorScheme}
              variant="solid"
              onClick={onClickConfirm}
            >
              {okText || t('common.buttons.confirm')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

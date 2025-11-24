import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
} from "@chakra-ui/react";
import { ComponentPropertiesPanel } from "./ComponentPropertiesPanel";
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";
import { Component } from "./types";

interface SlidingConfigPanelProps {
  onClose: () => void;
  component: Component | null;
}

export const SlidingConfigPanel: React.FC<SlidingConfigPanelProps> = ({ onClose, component }) => {
  const isOpen = !!component;

  const onDeleted = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} motionPreset="slideInBottom" size="full">
      <ModalOverlay />
      <ModalContent
        bg="gray.800"
        borderTop="1px solid"
        borderTopRadius="xl"
        borderColor="gray.600"
        height="55vh"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        shadow="2xl"
        boxShadow="0 -4px 25px 0 rgba(0, 0, 0, 0.4)"
        margin={0}
      >
        <ModalHeader
          py={2}
          px={4}
          borderBottom="1px solid"
          borderColor="gray.600"
          fontSize="md"
          fontWeight="semibold"
          color="white"
        >
          Configure {component ? getPreviewerComponentLabel(component.type) : "Component"}
        </ModalHeader>
        <ModalCloseButton color="gray.400" _hover={{ color: "white", bg: "gray.700" }} />
        <ModalBody p={4} height="calc(100% - 120px)" overflowY="auto" bg="gray.800">
          {component && (
            <ComponentPropertiesPanel
              hideTitle
              selectedComponentId={component.id}
              onDeleted={onDeleted}
            />
          )}
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor="gray.600" bg="gray.800" p={4}>
          <Button colorScheme="gray" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

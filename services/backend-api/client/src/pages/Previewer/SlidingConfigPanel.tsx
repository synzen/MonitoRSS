import React, { useState } from "react";
import { Box, HStack, Text, IconButton, Slide } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { createFocusTrap, FocusTrap } from "focus-trap";
import { ComponentPropertiesPanel } from "./ComponentPropertiesPanel";
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";
import { Component } from "./types";

interface SlidingConfigPanelProps {
  onClose: () => void;
  component: Component | null;
}

export const SlidingConfigPanel: React.FC<SlidingConfigPanelProps> = ({ onClose, component }) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const [focusTrap, setFocusTrap] = useState<FocusTrap | null>(null);
  const isOpen = !!component;

  // Initialize focus trap
  React.useEffect(() => {
    if (panelRef.current) {
      setFocusTrap(
        createFocusTrap(panelRef.current, {
          initialFocus: () => closeButtonRef.current,
          escapeDeactivates: false, // We handle escape ourselves
          clickOutsideDeactivates: false, // We handle backdrop clicks ourselves
        })
      );
    }

    return () => {
      if (focusTrap) {
        focusTrap.deactivate();
      }
    };
  }, []);

  // Activate/deactivate focus trap based on isOpen state
  React.useEffect(() => {
    if (focusTrap) {
      if (isOpen) {
        focusTrap.activate();
      } else {
        focusTrap.deactivate();
      }
    }
  }, [isOpen]);

  const onDeleted = () => {
    focusTrap?.deactivate();
    onClose();
  };

  // Handle escape key press
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.500"
          zIndex={40}
        />
      )}
      {/* Sliding Panel */}
      <Slide direction="bottom" in={isOpen} style={{ zIndex: 50 }}>
        <Box
          ref={panelRef}
          bg="gray.800"
          borderTop="1px solid"
          borderTopRadius="xl"
          borderColor="gray.600"
          height="55vh"
          role="dialog"
          aria-labelledby="sliding-config-panel-title"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          {...(isOpen && {
            shadow: "2xl",
            boxShadow: "0 -4px 25px 0 rgba(0, 0, 0, 0.4)",
          })}
        >
          <HStack
            justify="space-between"
            align="center"
            py={2}
            px={4}
            borderBottom="1px solid"
            borderColor="gray.600"
          >
            <Text id="sliding-config-panel-title" fontSize="md" fontWeight="semibold" color="white">
              Configure {component ? getPreviewerComponentLabel(component.type) : "Component"}
            </Text>
            <IconButton
              ref={closeButtonRef}
              icon={<CloseIcon />}
              size="sm"
              variant="ghost"
              aria-label="Close"
              onClick={onClose}
              color="gray.400"
              _hover={{ color: "white", bg: "gray.700" }}
            />
          </HStack>
          <Box p={4} height="calc(100% - 73px)" overflowY="auto" bg="gray.800">
            {component && (
              <ComponentPropertiesPanel
                hideTitle
                selectedComponentId={component.id}
                onDeleted={onDeleted}
              />
            )}
          </Box>
        </Box>
      </Slide>
    </>
  );
};

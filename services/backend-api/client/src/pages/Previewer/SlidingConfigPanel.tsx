import React from "react";
import { Box, HStack, Text, IconButton, Slide, useOutsideClick } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { ComponentPropertiesPanel } from "./ComponentPropertiesPanel";

interface SlidingConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  component: any;
}

export const SlidingConfigPanel: React.FC<SlidingConfigPanelProps> = ({
  isOpen,
  onClose,
  component,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);

  useOutsideClick({
    ref: panelRef,
    handler: onClose,
    enabled: isOpen,
  });

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
          bg="blackAlpha.300"
          zIndex={40}
          onClick={onClose}
        />
      )}
      {/* Sliding Panel */}
      <Slide direction="bottom" in={isOpen} style={{ zIndex: 50 }}>
        <Box
          ref={panelRef}
          bg="gray.800"
          borderTop="1px solid"
          borderColor="gray.600"
          height="55vh"
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
            <Text fontSize="md" fontWeight="semibold" color="white">
              Configure {component?.type || "Component"}
            </Text>
            <IconButton
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
            {component && <ComponentPropertiesPanel hideTitle selectedComponentId={component.id} />}
          </Box>
        </Box>
      </Slide>
    </>
  );
};

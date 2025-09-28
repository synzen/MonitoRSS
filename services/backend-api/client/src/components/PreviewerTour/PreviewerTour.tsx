import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Portal,
  VStack,
  Text,
  Button,
  HStack,
  Heading,
  Icon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaLightbulb, FaArrowRight, FaArrowLeft, FaTimes } from "react-icons/fa";

const TOUR_STORAGE_KEY = "previewer-tour-completed";

export interface TourStep {
  id: string;
  target: string; // CSS selector or data-tour-target attribute
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
  offset?: { x: number; y: number };
}

export const PREVIEWER_TOUR_STEPS: TourStep[] = [
  {
    id: "components-section",
    target: "[data-tour-target='components-section']",
    title: "Message Components",
    content: "This is where you can view and manage all the components that make up your Discord message. Each component represents a part of your message like text, embeds, or buttons.",
    placement: "right",
    offset: { x: 20, y: 0 },
  },
  {
    id: "add-component-button",
    target: "[data-tour-target='add-component-button']",
    title: "Add New Components", 
    content: "Click here to add new components to your message. You can add text blocks, embeds, buttons, and more to customize how your feed messages appear.",
    placement: "bottom",
    offset: { x: 0, y: 20 },
  },
  {
    id: "properties-panel",
    target: "[data-tour-target='properties-panel']",
    title: "Component Properties",
    content: "When you select a component, its properties will appear here. This is where you can customize the content, styling, and behavior of each component.",
    placement: "left",
    offset: { x: -20, y: 0 },
  },
  {
    id: "problems-section",
    target: "[data-tour-target='problems-section']",
    title: "Validation Problems",
    content: "Any issues with your message configuration will appear here. This helps you identify and fix problems before saving your message format.",
    placement: "top",
    offset: { x: 0, y: -20 },
  },
  {
    id: "save-discard-buttons",
    target: "[data-tour-target='save-discard-buttons']",
    title: "Save Your Changes",
    content: "Once you're happy with your message design, use these buttons to save your changes or discard them if you want to start over.",
    placement: "bottom",
    offset: { x: 0, y: 20 },
  },
];

interface TourTooltipProps {
  step: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  targetRect: DOMRect | null;
}

const TourTooltip: React.FC<TourTooltipProps> = ({
  step,
  currentStepIndex,
  totalSteps,
  onNext,
  onPrevious,
  onClose,
  targetRect,
}) => {
  if (!targetRect) return null;

  const getTooltipPosition = () => {
    const tooltipWidth = 320;
    const tooltipHeight = 200; // approximate
    const offset = step.offset || { x: 0, y: 0 };

    let x = targetRect.left;
    let y = targetRect.top;

    switch (step.placement) {
      case "right":
        x = targetRect.right + offset.x;
        y = targetRect.top + (targetRect.height - tooltipHeight) / 2 + offset.y;
        break;
      case "left":
        x = targetRect.left - tooltipWidth + offset.x;
        y = targetRect.top + (targetRect.height - tooltipHeight) / 2 + offset.y;
        break;
      case "bottom":
        x = targetRect.left + (targetRect.width - tooltipWidth) / 2 + offset.x;
        y = targetRect.bottom + offset.y;
        break;
      case "top":
      default:
        x = targetRect.left + (targetRect.width - tooltipWidth) / 2 + offset.x;
        y = targetRect.top - tooltipHeight + offset.y;
        break;
    }

    // Ensure tooltip stays within viewport
    x = Math.max(20, Math.min(x, window.innerWidth - tooltipWidth - 20));
    y = Math.max(20, Math.min(y, window.innerHeight - tooltipHeight - 20));

    return { x, y };
  };

  const position = getTooltipPosition();

  return (
    <Portal>
      {/* Dark overlay frames around the highlighted element */}
      {/* Top overlay */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        height={targetRect.top - 8}
        bg="blackAlpha.700"
        zIndex={9998}
      />
      {/* Bottom overlay */}
      <Box
        position="fixed"
        top={targetRect.bottom + 8}
        left={0}
        right={0}
        bottom={0}
        bg="blackAlpha.700"
        zIndex={9998}
      />
      {/* Left overlay */}
      <Box
        position="fixed"
        top={targetRect.top - 8}
        left={0}
        width={targetRect.left - 8}
        height={targetRect.height + 16}
        bg="blackAlpha.700"
        zIndex={9998}
      />
      {/* Right overlay */}
      <Box
        position="fixed"
        top={targetRect.top - 8}
        left={targetRect.right + 8}
        right={0}
        height={targetRect.height + 16}
        bg="blackAlpha.700"
        zIndex={9998}
      />

      {/* Highlighted target element overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
        }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        style={{
          position: "fixed",
          left: targetRect.left - 8,
          top: targetRect.top - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <Box
          width="100%"
          height="100%"
          borderRadius="lg"
          border="4px solid"
          borderColor="blue.400"
          bg="rgba(59, 130, 246, 0.1)"
          position="relative"
        >
          <motion.div
            animate={{ 
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            style={{
              position: "absolute",
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              border: "2px solid #60A5FA",
              borderRadius: "12px",
              boxShadow: "0 0 20px rgba(96, 165, 250, 0.6)",
            }}
          />
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          zIndex: 10000,
        }}
      >
        <Box
          bg="blue.600"
          color="white"
          p={4}
          borderRadius="md"
          shadow="xl"
          maxWidth="320px"
          border="2px solid"
          borderColor="blue.400"
        >
          <VStack align="start" spacing={3}>
            <HStack justify="space-between" width="100%">
              <Heading size="sm" color="blue.100">
                {step.title}
              </Heading>
              <Button
                size="xs"
                variant="ghost"
                colorScheme="whiteAlpha"
                onClick={onClose}
                aria-label="Close tour"
              >
                <Icon as={FaTimes} />
              </Button>
            </HStack>
            
            <Text fontSize="sm" lineHeight="1.5">
              {step.content}
            </Text>

            <HStack justify="space-between" width="100%">
              <Text fontSize="xs" color="blue.200">
                {currentStepIndex + 1} of {totalSteps}
              </Text>
              
              <HStack spacing={2}>
                {currentStepIndex > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="whiteAlpha"
                    leftIcon={<Icon as={FaArrowLeft} />}
                    onClick={onPrevious}
                  >
                    Back
                  </Button>
                )}
                
                <Button
                  size="sm"
                  colorScheme="blue"
                  bg="blue.500"
                  _hover={{ bg: "blue.400" }}
                  rightIcon={currentStepIndex < totalSteps - 1 ? <Icon as={FaArrowRight} /> : undefined}
                  onClick={onNext}
                >
                  {currentStepIndex < totalSteps - 1 ? "Next" : "Finish"}
                </Button>
              </HStack>
            </HStack>
          </VStack>
        </Box>
      </motion.div>
    </Portal>
  );
};

interface PreviewerTourProps {
  onComplete?: () => void;
}

export const PreviewerTour: React.FC<PreviewerTourProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isActive, setIsActive] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Check if user has completed the tour
  const hasCompletedTour = useCallback(() => {
    try {
      return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }, []);

  // Mark tour as completed
  const markTourCompleted = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  // Start the tour
  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
    onClose();
  }, [onClose]);

  // Update target element position
  const updateTargetRect = useCallback(() => {
    if (!isActive || currentStepIndex >= PREVIEWER_TOUR_STEPS.length) {
      setTargetRect(null);
      return;
    }

    const step = PREVIEWER_TOUR_STEPS[currentStepIndex];
    const element = document.querySelector(step.target);
    
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStepIndex]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStepIndex < PREVIEWER_TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Tour complete
      setIsActive(false);
      markTourCompleted();
      onComplete?.();
    }
  }, [currentStepIndex, markTourCompleted, onComplete]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // Handle close tour
  const handleClose = useCallback(() => {
    setIsActive(false);
    markTourCompleted();
    onComplete?.();
  }, [markTourCompleted, onComplete]);

  // Auto-start tour if not completed
  useEffect(() => {
    if (!hasCompletedTour()) {
      // Wait a bit for the page to render
      const timer = setTimeout(() => {
        onOpen();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTour, onOpen]);

  // Update target position when step changes or on scroll/resize
  useEffect(() => {
    updateTargetRect();

    if (isActive) {
      const handleUpdate = () => updateTargetRect();
      window.addEventListener("scroll", handleUpdate, true);
      window.addEventListener("resize", handleUpdate);
      
      return () => {
        window.removeEventListener("scroll", handleUpdate, true);
        window.removeEventListener("resize", handleUpdate);
      };
    }
  }, [isActive, updateTargetRect]);

  const currentStep = PREVIEWER_TOUR_STEPS[currentStepIndex];

  return (
    <>
      {/* Welcome Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md" closeOnOverlayClick={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Icon as={FaLightbulb} color="yellow.400" />
              <Text>Welcome to the Message Previewer!</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="start" spacing={4}>
              <Text>
                It looks like this is your first time using the message previewer. 
                Would you like a quick tour to learn about the key features?
              </Text>
              <Text fontSize="sm" color="gray.600">
                This tour will show you how to customize your Discord messages, 
                add components, and fix any issues that might arise.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onClose}>
                Skip Tour
              </Button>
              <Button colorScheme="blue" onClick={startTour}>
                Start Tour
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Tour Tooltip */}
      {isActive && currentStep && targetRect && (
        <TourTooltip
          step={currentStep}
          currentStepIndex={currentStepIndex}
          totalSteps={PREVIEWER_TOUR_STEPS.length}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onClose={handleClose}
          targetRect={targetRect}
        />
      )}
    </>
  );
};

export default PreviewerTour;
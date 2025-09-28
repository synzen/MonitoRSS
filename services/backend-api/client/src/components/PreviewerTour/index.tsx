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
import { FaArrowRight, FaArrowLeft, FaTimes } from "react-icons/fa";
import { FaScrewdriverWrench } from "react-icons/fa6";
import { useIsPreviewerMobile } from "../../hooks";

export const TOUR_STORAGE_KEY = "message-builder-tour-completed";

export interface TourStep {
  id: string;
  target: string; // CSS selector or data-tour-target attribute
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
  offset?: { x: number; y: number };
}

export const MESSAGE_BUILDER_TOUR_STEPS: TourStep[] = [
  {
    id: "components-section",
    target: "[data-tour-target='components-section']",
    title: "Message Components",
    content:
      "This is where you can view and manage all the components that make up your Discord message. Each component represents a part of your message like text, embeds, or buttons.",
    placement: "right",
    offset: { x: 20, y: 0 },
  },
  {
    id: "add-component-button",
    target: "[data-tour-target='add-component-button']",
    title: "Add New Components",
    content:
      "After you've selected a component, you may click here to add new components under the selected component. You can add text blocks, embeds, buttons, and more to customize how your feed messages appear.",
    placement: "bottom",
    offset: { x: 0, y: 20 },
  },
  {
    id: "properties-panel",
    target: "[data-tour-target='properties-panel']",
    title: "Component Properties",
    content:
      "When you select a component, its properties will appear here. This is where you can customize the content, styling, and behavior of each component.",
    placement: "left",
    offset: { x: -20, y: 0 },
  },
  {
    id: "discord-preview",
    target: "[data-tour-target='discord-preview']",
    title: "Discord Message Preview",
    content:
      "This shows an approximation of how your Discord message might look when posted to your channel. The preview updates in real-time as you make changes to your message components.",
    placement: "left",
    offset: { x: -20, y: 0 },
  },
  {
    id: "article-banner",
    target: "[data-tour-target='article-banner']",
    title: "Article Selection",
    content:
      "The preview changes based on the selected article from your feed. You can change articles to see how your message format looks with different content.\n\nUse 'Send to Discord' to send the article to Discord and see how it actually looks since it may have slight differences from the preview.",
    placement: "bottom",
    offset: { x: 0, y: 20 },
  },
  {
    id: "problems-section",
    target: "[data-tour-target='problems-section']",
    title: "Problems",
    content:
      "Any issues with your customizations will appear here. This helps you identify and fix problems before saving your message format.",
    placement: "top",
    offset: { x: 0, y: -20 },
  },
  {
    id: "save-discard-buttons",
    target: "[data-tour-target='save-discard-buttons']",
    title: "Save Your Changes",
    content:
      "Once you're happy with your customizations, use these buttons to save your changes or discard them if you want to start over. All changes are temporary until you save them.",
    placement: "bottom",
    offset: { x: 0, y: 20 },
  },
];

interface TourState {
  step: TourStep;
  stepIndex: number;
  targetRect: DOMRect | null;
}

interface TourTooltipProps {
  tourState: TourState;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

const TourTooltip: React.FC<TourTooltipProps> = ({
  tourState,
  totalSteps,
  onNext,
  onPrevious,
  onClose,
}) => {
  const { step, stepIndex, targetRect } = tourState;

  // Callback ref to focus the button immediately when it's available
  const closeButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      if (node) {
        // Multiple attempts to ensure focus is set
        const focusButton = () => {
          if (node.isConnected && !node.disabled) {
            node.focus();
          }
        };

        // Try immediately
        focusButton();

        // Try again after animation completes
        setTimeout(focusButton, 200);
      }
    },
    [stepIndex]
  );

  // During transitions, we might not have targetRect yet
  // In this case, render with opacity 0 to maintain overlay
  if (!targetRect) {
    return (
      <Portal>
        {/* Full screen overlay during transition to prevent white flash */}
        <Box
          position="fixed"
          top={0}
          left={0}
          width="100vw"
          height="100vh"
          bg="blackAlpha.700"
          zIndex={9998}
        />
      </Portal>
    );
  }

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
      {/* Screen reader announcement for step changes */}
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position: "absolute",
          left: "-10000px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        Tour step {stepIndex + 1} of {totalSteps}: {step.title}.{" "}
        {step.content.split("\n").map((line, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={idx}>
            {line} <br />
          </span>
        ))}
      </div>
      {/* Dark overlay frames around the highlighted element */}
      {/* Top overlay */}
      <Box
        data-overlay-pos="top"
        position="fixed"
        top={0}
        left={0}
        right={0}
        height={`${targetRect.top - 8}px`}
        bg="blackAlpha.700"
        zIndex={9998}
        aria-hidden="true"
      />
      {/* Bottom overlay */}
      <Box
        data-overlay-pos="bottom"
        position="fixed"
        top={`${targetRect.bottom + 8}px`}
        left={0}
        right={0}
        bottom={0}
        bg="blackAlpha.700"
        zIndex={9998}
        aria-hidden="true"
      />
      {/* Left overlay */}
      <Box
        data-overlay-pos="left"
        position="fixed"
        top={`${targetRect.top - 8}px`}
        left={0}
        width={`${targetRect.left - 8}px`}
        height={`${targetRect.height + 16}px`}
        bg="blackAlpha.700"
        zIndex={9998}
        aria-hidden="true"
      />
      {/* Right overlay */}
      <Box
        data-overlay-pos="right"
        position="fixed"
        top={`${targetRect.top - 8}px`}
        left={`${targetRect.right + 8}px`}
        right={0}
        height={`${targetRect.height + 16}px`}
        bg="blackAlpha.700"
        zIndex={9998}
        aria-hidden="true"
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
        aria-hidden="true"
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
              ease: "easeInOut",
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
          bg="gray.800"
          color="white"
          p={4}
          borderRadius="md"
          shadow="xl"
          maxWidth="320px"
          border="2px solid"
          borderColor="blue.300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-step-title"
          aria-describedby="tour-step-content"
          aria-live="polite"
          aria-atomic="true"
        >
          <VStack align="start" spacing={3}>
            <HStack justify="space-between" width="100%">
              <Heading id="tour-step-title" size="sm" color="white">
                {step.title}
              </Heading>
              <Button
                size="xs"
                variant="ghost"
                colorScheme="gray"
                color="gray.300"
                _hover={{ bg: "gray.700", color: "white" }}
                onClick={onClose}
                aria-label={`Close tour. Currently on step ${stepIndex + 1} of ${totalSteps}.`}
                ref={closeButtonRef}
              >
                <Icon as={FaTimes} />
              </Button>
            </HStack>
            <Text id="tour-step-content" fontSize="sm" lineHeight="1.5">
              {step.content.split("\n").map((line, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <span key={idx}>
                  {line} <br />
                </span>
              ))}
            </Text>
            <HStack justify="space-between" width="100%">
              <Text fontSize="xs" color="gray.300" aria-live="polite" role="status">
                Step {stepIndex + 1} of {totalSteps}
              </Text>
              <HStack spacing={2}>
                {stepIndex > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="gray.500"
                    color="gray.300"
                    _hover={{
                      bg: "gray.700",
                      borderColor: "gray.400",
                      color: "white",
                    }}
                    leftIcon={<Icon as={FaArrowLeft} />}
                    onClick={onPrevious}
                    aria-label={`Go to previous step: ${
                      MESSAGE_BUILDER_TOUR_STEPS[stepIndex - 1]?.title || "Previous"
                    }. Currently step ${stepIndex + 1} of ${totalSteps}.`}
                  >
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  bg="blue.500"
                  color="white"
                  _hover={{ bg: "blue.400" }}
                  _active={{ bg: "blue.600" }}
                  rightIcon={stepIndex < totalSteps - 1 ? <Icon as={FaArrowRight} /> : undefined}
                  onClick={onNext}
                  tabIndex={0}
                  autoFocus
                  aria-label={
                    stepIndex < totalSteps - 1
                      ? `Continue to next step: ${
                          MESSAGE_BUILDER_TOUR_STEPS[stepIndex + 1]?.title || "Next"
                        }. Currently step ${stepIndex + 1} of ${totalSteps}.`
                      : `Complete tour. This is the final step, step ${
                          stepIndex + 1
                        } of ${totalSteps}.`
                  }
                >
                  {stepIndex < totalSteps - 1 ? "Next" : "Finish"}
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
  resetTrigger?: number;
}

export const PreviewerTour: React.FC<PreviewerTourProps> = ({ onComplete, resetTrigger }) => {
  const [tourState, setTourState] = useState<TourState | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useIsPreviewerMobile();

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

  // Focus on the "Customize Message" heading after tour completion
  const focusOnCustomizeMessageHeading = useCallback(() => {
    const heading = document.querySelector("h1");
    heading?.focus();
  }, []);

  // Start the tour
  const startTour = useCallback(() => {
    // Save current focus to restore later

    const initialStep = MESSAGE_BUILDER_TOUR_STEPS[0];
    setTourState({
      step: initialStep,
      stepIndex: 0,
      targetRect: null,
    });
    setIsActive(true);
    onClose();
  }, [onClose]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (!tourState) return;

    if (tourState.stepIndex < MESSAGE_BUILDER_TOUR_STEPS.length - 1) {
      setIsTransitioning(true);
      const nextIndex = tourState.stepIndex + 1;
      const nextStep = MESSAGE_BUILDER_TOUR_STEPS[nextIndex];
      setTourState({
        step: nextStep,
        stepIndex: nextIndex,
        targetRect: null, // Will be updated by updateTargetRect
      });
      // Reset transition state after a brief delay
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150);
    } else {
      // Tour complete
      setIsActive(false);
      setTourState(null);
      markTourCompleted();

      // Focus on the "Customize Message" heading after tour completion
      setTimeout(() => {
        focusOnCustomizeMessageHeading();
      }, 100);

      onComplete?.();
    }
  }, [tourState, markTourCompleted, onComplete, focusOnCustomizeMessageHeading]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (!tourState || tourState.stepIndex <= 0) return;

    setIsTransitioning(true);
    const prevIndex = tourState.stepIndex - 1;
    const prevStep = MESSAGE_BUILDER_TOUR_STEPS[prevIndex];
    setTourState({
      step: prevStep,
      stepIndex: prevIndex,
      targetRect: null, // Will be updated by updateTargetRect
    });
    // Reset transition state after a brief delay
    setTimeout(() => {
      setIsTransitioning(false);
    }, 150);
  }, [tourState]);

  // Handle close tour
  const handleClose = useCallback(() => {
    setIsActive(false);
    setTourState(null);
    markTourCompleted();

    // Focus on the "Customize Message" heading after tour closes
    setTimeout(() => {
      focusOnCustomizeMessageHeading();
    }, 100);

    onComplete?.();
  }, [markTourCompleted, onComplete, focusOnCustomizeMessageHeading]);

  // Auto-start tour if not completed (skip on mobile)
  useEffect(() => {
    if (!hasCompletedTour() && !isMobile) {
      // Wait a bit for the page to render
      const timer = setTimeout(() => {
        onOpen();
      }, 1000);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [hasCompletedTour, onOpen, isMobile]);

  // Handle programmatic tour reset (skip on mobile)
  useEffect(() => {
    if (resetTrigger && resetTrigger > 0 && !isMobile) {
      // Reset any active tour state
      setIsActive(false);
      setTourState(null);
      setIsTransitioning(false);

      // Open the welcome modal after a short delay
      const timer = setTimeout(() => {
        onOpen();
      }, 100);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [resetTrigger, onOpen, isMobile]);

  // Update target position when step changes or on scroll/resize
  useEffect(() => {
    if (!isActive || !tourState) {
      return undefined;
    }

    const updateRect = () => {
      if (!isActive || !tourState || tourState.stepIndex >= MESSAGE_BUILDER_TOUR_STEPS.length) {
        return;
      }

      const { step } = tourState;
      const element = document.querySelector(step.target);

      if (element) {
        const rect = element.getBoundingClientRect();

        // Only update if we have valid dimensions
        if (rect.width > 0 && rect.height > 0) {
          setTourState((prev) => {
            if (!prev) return null;

            // Check if rect has actually changed to prevent unnecessary updates
            const currentRect = prev.targetRect;

            if (
              currentRect &&
              currentRect.left === rect.left &&
              currentRect.top === rect.top &&
              currentRect.width === rect.width &&
              currentRect.height === rect.height
            ) {
              return prev; // No change needed
            }

            return { ...prev, targetRect: rect };
          });
        }
      } else {
        // If element not found, try again after a short delay
        setTimeout(() => {
          const retryElement = document.querySelector(step.target);

          if (retryElement) {
            const rect = retryElement.getBoundingClientRect();

            if (rect.width > 0 && rect.height > 0) {
              setTourState((prev) => (prev ? { ...prev, targetRect: rect } : null));
            }
          }
        }, 50);
      }
    };

    // Initial update
    updateRect();

    // Set up scroll and resize listeners
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [isActive, tourState?.step.target, tourState?.stepIndex]);

  return (
    <>
      {/* Welcome Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md" closeOnOverlayClick={false}>
        <ModalOverlay />
        <ModalContent
          bg="gray.800"
          color="white"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-modal-title"
          aria-describedby="tour-modal-description"
        >
          <ModalHeader>
            <HStack>
              <Icon as={FaScrewdriverWrench} aria-hidden="true" />
              <Text id="tour-modal-title" color="white">
                Welcome to your Message Builder!
              </Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton aria-label="Close welcome dialog" />
          <ModalBody>
            <VStack align="start" spacing={4} id="tour-modal-description">
              <Text color="gray.200" lineHeight="1.6">
                Would you like a quick tour to learn how to customize your message?
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button
                variant="outline"
                onClick={() => {
                  markTourCompleted();
                  onClose();
                }}
                // borderColor="gray.500"
                // color="gray.300"
                // _hover={{ bg: "gray.700", borderColor: "gray.400" }}
                // _active={{ bg: "gray.600" }}
                aria-label="Skip the message builder tour and start using the feature"
              >
                Skip Tour
              </Button>
              <Button
                colorScheme="blue"
                // bg="blue.500"
                // color="white"
                // _hover={{ bg: "blue.600" }}
                // _active={{ bg: "blue.700" }}
                onClick={startTour}
                aria-label="Start the interactive tour to learn message builder features"
                autoFocus
              >
                Start Tour
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {/* Tour Tooltip */}
      {isActive && tourState && (tourState.targetRect || isTransitioning) && (
        <TourTooltip
          tourState={tourState}
          totalSteps={MESSAGE_BUILDER_TOUR_STEPS.length}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default PreviewerTour;

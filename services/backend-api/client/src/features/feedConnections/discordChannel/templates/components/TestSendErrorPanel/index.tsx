import { useEffect, useRef } from "react";
import {
  Box,
  Button,
  Collapse,
  Grid,
  Heading,
  HStack,
  Text,
  useDisclosure,
  Alert,
  AlertIcon,
  Flex,
} from "@chakra-ui/react";
import { FaExclamationTriangle, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { TestSendFeedback } from "../../types";
import getChakraColor from "@/utils/getChakraColor";

export interface TestSendErrorPanelProps {
  feedback: TestSendFeedback;
  onTryAnother: () => void;
  onUseAnyway: () => void;
  isUseAnywayLoading?: boolean;
}

const TestSendErrorPanel = ({
  feedback,
  onTryAnother,
  onUseAnyway,
  isUseAnywayLoading,
}: TestSendErrorPanelProps) => {
  const { isOpen: isDetailsOpen, onToggle: onToggleDetails } = useDisclosure();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const hasApiDetails = feedback.apiPayload || feedback.apiResponse;

  // Focus heading when panel appears
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <Box
      role="region"
      aria-labelledby="test-send-error-heading"
      aria-describedby="test-send-error-description"
      p={{ base: 4, md: 6 }}
    >
      <HStack spacing={3} alignItems="center" mb={4}>
        <Box color="orange.300" fontSize="xl">
          <FaExclamationTriangle />
        </Box>
        <Heading
          ref={headingRef}
          id="test-send-error-heading"
          size="md"
          color="white"
          tabIndex={-1}
          outline="none"
        >
          Discord couldn&apos;t send this preview
        </Heading>
      </HStack>
      <Text id="test-send-error-description" color="gray.300" mb={6}>
        {feedback.message}
      </Text>
      {hasApiDetails && (
        <Box mb={6}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDetails}
            leftIcon={isDetailsOpen ? <FaChevronDown /> : <FaChevronRight />}
            color="gray.400"
            _hover={{ color: "white" }}
            mb={2}
            aria-expanded={isDetailsOpen}
            aria-controls="technical-details-section"
          >
            Technical Details
          </Button>
          <Collapse in={isDetailsOpen} animateOpacity>
            <Box
              id="technical-details-section"
              bg="gray.700"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.600"
              p={4}
              overflow="hidden"
            >
              <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
                {feedback.apiPayload && (
                  <Box minW={0}>
                    <Heading size="sm" color="gray.300" mb={2}>
                      Request Sent to Discord
                    </Heading>
                    <Box
                      as="pre"
                      bg={getChakraColor("gray.800")}
                      p={{ base: 3, md: 4 }}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.600"
                      overflow="auto"
                      maxH={{ base: "150px", md: "250px" }}
                      fontSize="xs"
                      color="gray.200"
                    >
                      {JSON.stringify(feedback.apiPayload, null, 2)}
                    </Box>
                  </Box>
                )}
                {feedback.apiResponse && (
                  <Box minW={0}>
                    <Heading size="sm" color="gray.300" mb={2}>
                      Discord&apos;s Response
                    </Heading>
                    <Box
                      as="pre"
                      bg={getChakraColor("gray.800")}
                      p={{ base: 3, md: 4 }}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.600"
                      overflow="auto"
                      maxH={{ base: "150px", md: "250px" }}
                      fontSize="xs"
                      color="gray.200"
                    >
                      {JSON.stringify(feedback.apiResponse, null, 2)}
                    </Box>
                  </Box>
                )}
              </Grid>
            </Box>
          </Collapse>
        </Box>
      )}
      <Alert status="info" borderRadius="md" mb={6}>
        <AlertIcon />
        <Box>
          <Text fontWeight="semibold">Some articles may not deliver with this template</Text>
          <Text fontSize="sm">
            If an article fails to send due to this error, the connection will pause until you
            adjust the format.
          </Text>
        </Box>
      </Alert>
      <Flex
        direction={{ base: "column", sm: "row" }}
        justifyContent="center"
        alignItems="center"
        gap={{ base: 3, sm: 4 }}
      >
        <Button variant="outline" onClick={onTryAnother} w={{ base: "100%", sm: "auto" }}>
          Try Another Template
        </Button>
        <Button
          colorScheme="blue"
          onClick={onUseAnyway}
          isLoading={isUseAnywayLoading}
          w={{ base: "100%", sm: "auto" }}
        >
          Use this template
        </Button>
      </Flex>
    </Box>
  );
};

export { TestSendErrorPanel };

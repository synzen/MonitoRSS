import { useEffect, useRef } from "react";
import {
  Box,
  Button,
  Alert,
  Grid,
  Heading,
  HStack,
  Text,
  useDisclosure,
  Flex,
} from "@chakra-ui/react";
import { FaExclamationTriangle, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { TestSendFeedback } from "../../types";
import { Panel } from "@/components/Panel";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";

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
  const { open: isDetailsOpen, onToggle: onToggleDetails } = useDisclosure();
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
      <HStack gap={3} alignItems="center" mb={4}>
        <Box color="text.warning" fontSize="xl">
          <FaExclamationTriangle />
        </Box>
        <Heading
          ref={headingRef}
          id="test-send-error-heading"
          size="md"
          color="fg"
          tabIndex={-1}
          outline="none"
        >
          Discord couldn&apos;t send this preview
        </Heading>
      </HStack>
      <Text id="test-send-error-description" color="fg.muted" mb={6}>
        {feedback.message}
      </Text>
      {hasApiDetails && (
        <Box mb={6}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDetails}
            color="fg.muted"
            _hover={{ color: "fg" }}
            mb={2}
            aria-expanded={isDetailsOpen}
            aria-controls="technical-details-section"
          >
            {isDetailsOpen ? <FaChevronDown /> : <FaChevronRight />}
            Technical Details
          </Button>
          {isDetailsOpen && (
            <Panel id="technical-details-section" p={4} overflow="hidden">
              <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
                {feedback.apiPayload && (
                  <Box minW={0}>
                    <Heading size="sm" color="fg.muted" mb={2}>
                      Request Sent to Discord
                    </Heading>
                    <Box
                      as="pre"
                      bg="bg.emphasized"
                      p={{ base: 3, md: 4 }}
                      borderRadius="l3"
                      borderWidth="1px"
                      borderColor="border"
                      overflow="auto"
                      maxH={{ base: "150px", md: "250px" }}
                      fontSize="xs"
                      color="fg.muted"
                    >
                      {JSON.stringify(feedback.apiPayload, null, 2)}
                    </Box>
                  </Box>
                )}
                {feedback.apiResponse && (
                  <Box minW={0}>
                    <Heading size="sm" color="fg.muted" mb={2}>
                      Discord&apos;s Response
                    </Heading>
                    <Box
                      as="pre"
                      bg="bg.emphasized"
                      p={{ base: 3, md: 4 }}
                      borderRadius="l3"
                      borderWidth="1px"
                      borderColor="border"
                      overflow="auto"
                      maxH={{ base: "150px", md: "250px" }}
                      fontSize="xs"
                      color="fg.muted"
                    >
                      {JSON.stringify(feedback.apiResponse, null, 2)}
                    </Box>
                  </Box>
                )}
              </Grid>
            </Panel>
          )}
        </Box>
      )}
      <Alert.Root status="info" mb={6}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Some articles may not deliver with this template</Alert.Title>
          <Alert.Description>
            If an article fails to send due to this error, the connection will pause until you
            adjust the format.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
      <Flex
        direction={{ base: "column", sm: "row" }}
        justifyContent="center"
        alignItems="center"
        gap={{ base: 3, sm: 4 }}
      >
        <Button variant="outline" onClick={onTryAnother} w={{ base: "100%", sm: "auto" }}>
          Try Another Template
        </Button>
        <PrimaryActionButton
          onClick={onUseAnyway}
          loading={isUseAnywayLoading}
          loadingText="Use this template"
          w={{ base: "100%", sm: "auto" }}
        >
          Use this template
        </PrimaryActionButton>
      </Flex>
    </Box>
  );
};

export { TestSendErrorPanel };

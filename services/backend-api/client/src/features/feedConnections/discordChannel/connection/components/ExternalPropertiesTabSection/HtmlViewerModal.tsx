import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Code,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { cloneElement, useState } from "react";
import { CopyIcon } from "@chakra-ui/icons";

interface Props {
  trigger: React.ReactElement;
  html: string;
  isTruncated?: boolean;
  cssSelector: string;
}

const MAX_INITIAL_DISPLAY = 50 * 1024; // 50KB initial display

export const HtmlViewerModal = ({ trigger, html, isTruncated, cssSelector }: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [showFull, setShowFull] = useState(false);
  const toast = useToast();

  const displayHtml = showFull ? html : html.substring(0, MAX_INITIAL_DISPLAY);
  const canShowMore = html.length > MAX_INITIAL_DISPLAY && !showFull;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      toast({
        title: "Copied to clipboard",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch {
      toast({
        title: "Failed to copy",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxHeight="85vh">
          <ModalHeader>
            <Stack spacing={1}>
              <Text>Page Source</Text>
              <Text fontSize="sm" fontWeight="normal" color="gray.400">
                Selector: <Code fontSize="sm">{cssSelector}</Code>
              </Text>
            </Stack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm">
                  Script tags have been removed to condense content.
                  {isTruncated && " HTML was also truncated to 50KB for display."}
                </Text>
              </Alert>
              <HStack justify="flex-end">
                <IconButton
                  aria-label="Copy HTML to clipboard"
                  icon={<CopyIcon />}
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                />
              </HStack>
              <Box
                as="pre"
                bg="gray.900"
                p={4}
                borderRadius="md"
                overflow="auto"
                fontSize="xs"
                fontFamily="mono"
                whiteSpace="pre-wrap"
                wordBreak="break-all"
                maxHeight="55vh"
              >
                <code>{displayHtml}</code>
              </Box>
              {canShowMore && (
                <HStack justify="center">
                  <Button size="sm" variant="ghost" onClick={() => setShowFull(true)}>
                    Show more ({Math.round((html.length - MAX_INITIAL_DISPLAY) / 1024)}KB remaining)
                  </Button>
                </HStack>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default HtmlViewerModal;

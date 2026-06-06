import { Alert, Box, Button, Code, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { cloneElement, useState } from "react";
import { FaCopy } from "react-icons/fa6";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { toaster } from "@/components/ui/toaster";

interface Props {
  trigger: React.ReactElement;
  html: string;
  isTruncated?: boolean;
  cssSelector: string;
}

const MAX_INITIAL_DISPLAY = 50 * 1024; // 50KB initial display

export const HtmlViewerModal = ({ trigger, html, isTruncated, cssSelector }: Props) => {
  const [open, setOpen] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const displayHtml = showFull ? html : html.substring(0, MAX_INITIAL_DISPLAY);
  const canShowMore = html.length > MAX_INITIAL_DISPLAY && !showFull;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      toaster.create({
        title: "Copied to clipboard",
        type: "success",
        duration: 2000,
      });
    } catch {
      toaster.create({
        title: "Failed to copy",
        type: "error",
        duration: 2000,
      });
    }
  };

  return (
    <>
      {cloneElement(trigger, { onClick: () => setOpen(true) })}
      <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="xl">
        <DialogContent maxHeight="85vh">
          <DialogHeader marginRight={4}>
            <DialogTitle>
              <Stack gap={1}>
                <Text>Page Source</Text>
                <Text fontSize="sm" fontWeight="normal" color="fg.muted">
                  Selector: <Code fontSize="sm">{cssSelector}</Code>
                </Text>
              </Stack>
            </DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <Stack gap={4}>
              <Alert.Root status="info">
                <Alert.Indicator />
                <Text fontSize="sm">
                  Script tags have been removed to condense content.
                  {isTruncated && " HTML was also truncated to 50KB for display."}
                </Text>
              </Alert.Root>
              <HStack justify="flex-end">
                <IconButton
                  aria-label="Copy HTML to clipboard"
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                >
                  <Icon as={FaCopy} />
                </IconButton>
              </HStack>
              <Box
                as="pre"
                bg="bg.subtle"
                borderWidth="1px"
                borderColor="border"
                p={4}
                borderRadius="l3"
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
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default HtmlViewerModal;

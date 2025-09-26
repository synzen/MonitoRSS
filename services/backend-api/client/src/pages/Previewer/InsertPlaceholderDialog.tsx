import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  Button,
  Box,
  Code,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
} from "@chakra-ui/react";
import { SearchIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { usePreviewerContext } from "./PreviewerContext";

interface MergeTag {
  tag: string;
  content: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectTag: (tag: string) => void;
}

export const InsertPlaceholderDialog: React.FC<Props> = ({ isOpen, onClose, onSelectTag }) => {
  const { error, isLoading, currentArticle } = usePreviewerContext();
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const placeholders: MergeTag[] = React.useMemo(() => {
    if (!currentArticle) return [];

    return Object.entries(currentArticle).map(([key, value]) => ({
      tag: `{{${key}}}`,
      content: value || `[Empty value]`,
    }));
  }, [currentArticle]);

  const filteredPlaceholders = placeholders.filter(
    (ph) =>
      ph.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ph.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectTag = (tag: string) => {
    onSelectTag(tag);
    onClose();
  };

  // Reset search and focus when modal closes/opens
  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    } else {
      // Focus search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      closeOnOverlayClick
      trapFocus
      blockScrollOnMount
    >
      <ModalOverlay />
      <ModalContent
        bg="gray.800"
        color="white"
        maxH="80vh"
        onClick={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-labelledby="insert-placeholder-title"
        aria-describedby="insert-placeholder-description"
      >
        <ModalHeader borderBottom="1px solid" borderColor="gray.600" id="insert-placeholder-title">
          Insert Placeholder
        </ModalHeader>
        <ModalCloseButton aria-label="Close placeholder dialog" />
        <ModalBody p={0}>
          <Box p={4} borderBottom="1px solid" borderColor="gray.600">
            <Text fontSize="sm" color="gray.400" mb={3} id="insert-placeholder-description">
              Select a placeholder to insert into your text content. The placeholder will be
              replaced with the actual article content when being previewed or published.
            </Text>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" aria-hidden="true" />
              </InputLeftElement>
              <Input
                ref={searchInputRef}
                placeholder="Search placeholders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="gray.700"
                isDisabled={!!error || !!isLoading}
                aria-label="Search placeholders"
                aria-describedby="search-results-count"
              />
            </InputGroup>
            {!isLoading && !error && (
              <Text
                id="search-results-count"
                fontSize="xs"
                color="gray.500"
                mt={2}
                aria-live="polite"
                aria-atomic="true"
              >
                {filteredPlaceholders.length} placeholder
                {filteredPlaceholders.length !== 1 ? "s" : ""} found
              </Text>
            )}
          </Box>
          <VStack
            ref={listRef}
            spacing={0}
            align="stretch"
            maxH="60vh"
            overflowY="auto"
            role="listbox"
            aria-label="Available placeholders"
          >
            {isLoading && (
              <Box p={6} textAlign="center" role="status" aria-live="polite">
                <VStack spacing={4}>
                  <Spinner color="blue.400" size="lg" thickness="4px" aria-hidden="true" />
                  <Text color="gray.300" fontWeight="medium">
                    Loading Placeholders...
                  </Text>
                </VStack>
              </Box>
            )}
            {!isLoading && error && (
              <Box p={6} textAlign="center" role="alert" aria-live="assertive">
                <VStack spacing={4}>
                  <Text color="red.400" fontWeight="medium">
                    Failed to Load Placeholders
                  </Text>
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    Placeholders are unavailable because the article data could not be loaded. Try
                    refreshing the page or refetching preview articles in the preview section.
                  </Text>
                </VStack>
              </Box>
            )}
            {!isLoading && !error && filteredPlaceholders.length === 0 && (
              <Box p={6} textAlign="center" role="status">
                <Text color="gray.400" fontStyle="italic">
                  No placeholders found matching &apos;{searchTerm}&apos;
                </Text>
              </Box>
            )}
            {!isLoading &&
              !error &&
              filteredPlaceholders.length > 0 &&
              filteredPlaceholders.map((ph, index) => (
                <Button
                  key={ph.tag}
                  variant="ghost"
                  justifyContent="space-between"
                  p={4}
                  h="auto"
                  minH="auto"
                  borderRadius={0}
                  borderBottom={index < filteredPlaceholders.length - 1 ? "1px solid" : undefined}
                  borderColor="gray.600"
                  _hover={{ bg: "gray.700" }}
                  _focus={{ bg: "gray.700", outline: "2px solid", outlineColor: "blue.400" }}
                  onClick={() => handleSelectTag(ph.tag)}
                  role="option"
                  aria-label={`Insert ${ph.tag} placeholder. Preview: ${ph.content.slice(0, 100)}${
                    ph.content.length > 100 ? "..." : ""
                  }`}
                >
                  <VStack align="start" spacing={2} flex={1} w="full">
                    <Code colorScheme="blue" fontSize="sm" fontWeight="bold">
                      {ph.tag}
                    </Code>
                    <Text
                      fontSize="sm"
                      color="gray.300"
                      fontStyle={ph.content.startsWith("[") ? "italic" : "normal"}
                      textAlign="left"
                      w="full"
                      wordBreak="break-word"
                      whiteSpace="pre-wrap"
                      noOfLines={5}
                      aria-hidden="true"
                    >
                      {ph.content}
                    </Text>
                  </VStack>
                  <ChevronRightIcon
                    color="gray.400"
                    fontSize="lg"
                    ml={2}
                    flexShrink={0}
                    aria-hidden="true"
                  />
                </Button>
              ))}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

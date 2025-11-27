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
import { ChevronRightIcon, SearchIcon } from "@chakra-ui/icons";
import { Virtuoso } from "react-virtuoso";
import { useMessageBuilderContext } from "./MessageBuilderContext";

interface MergeTag {
  tag: string;
  content: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelected: (tag: string) => void;
  onCloseFocusRef?: React.RefObject<any> | undefined;
}

interface PlaceholderItemProps {
  placeholder: MergeTag;
  index: number;
  totalCount: number;
  onSelected: (tag: string) => void;
}

const PlaceholderItem: React.FC<PlaceholderItemProps> = ({
  placeholder,
  index,
  totalCount,
  onSelected,
}) => {
  const handleSelectTag = (tag: string) => {
    onSelected(tag);
  };

  return (
    <Box
      p={4}
      w="100%"
      borderRadius={0}
      borderBottom={index < totalCount - 1 ? "1px solid" : undefined}
      borderColor="gray.600"
      _hover={{ bg: "gray.700" }}
      aria-label={`Insert ${placeholder.tag} placeholder. Preview: ${placeholder.content.slice(
        0,
        100
      )}${placeholder.content.length > 100 ? "..." : ""}`}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        wordBreak="break-word"
      >
        <VStack align="start" spacing={2} flex={1} w="full" mr={4}>
          <Code colorScheme="blue" fontSize="sm" fontWeight="bold" userSelect="text">
            {placeholder.tag}
          </Code>
          <Text
            fontSize="sm"
            color="gray.300"
            fontStyle={placeholder.content.startsWith("[") ? "italic" : "normal"}
            textAlign="left"
            w="full"
            whiteSpace="normal"
            noOfLines={5}
            userSelect="text"
            aria-hidden="true"
          >
            {placeholder.content.split("\n").map((line, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <span key={idx}>
                {line} <br />
              </span>
            ))}
          </Text>
        </VStack>
        <Button
          size="sm"
          colorScheme="blue"
          variant="outline"
          onClick={() => handleSelectTag(placeholder.tag)}
          flexShrink={0}
          rightIcon={<ChevronRightIcon />}
          _focus={{ outline: "2px solid", outlineColor: "blue.400" }}
        >
          Select
        </Button>
      </Box>
    </Box>
  );
};

export const InsertPlaceholderDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelected,
  onCloseFocusRef,
}) => {
  const { error, isLoading, currentArticle } = useMessageBuilderContext();
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

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
    onSelected(tag);
    onClose();
  };

  const renderItem = React.useCallback(
    (index: number) => (
      <PlaceholderItem
        key={filteredPlaceholders[index].tag}
        placeholder={filteredPlaceholders[index]}
        index={index}
        totalCount={filteredPlaceholders.length}
        onSelected={handleSelectTag}
      />
    ),
    [filteredPlaceholders, handleSelectTag]
  );

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
      finalFocusRef={onCloseFocusRef}
    >
      <ModalOverlay />
      <ModalContent
        bg="gray.800"
        color="white"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <ModalHeader borderBottom="1px solid" borderColor="gray.600">
          Insert Placeholder
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={0}>
          <Box p={4} borderBottom="1px solid" borderColor="gray.600">
            <Text fontSize="sm" color="gray.400" mb={3}>
              Placeholders represent article content for the currently-selected article when being
              previewed or published. Select a placeholder to insert into your text content.
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
          <Box>
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
            {!isLoading && !error && filteredPlaceholders.length > 0 && (
              <Virtuoso
                aria-label="Available placeholders"
                style={{ height: "50vh", width: "100%" }}
                totalCount={filteredPlaceholders.length}
                itemContent={renderItem}
              />
            )}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

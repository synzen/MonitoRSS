import React from "react";
import {
  VStack,
  Text,
  Button,
  Box,
  Code,
  Input,
  InputGroup,
  Spinner,
  Link as ChakraLink,
  HStack,
} from "@chakra-ui/react";
import { FaChevronRight, FaUpRightFromSquare, FaMagnifyingGlass } from "react-icons/fa6";
import { Virtuoso } from "react-virtuoso";
import { Link } from "react-router-dom";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import { useUserFeedConnectionContext } from "@/features/feed";
import { pages } from "@/constants";
import { UserFeedConnectionTabSearchParam } from "@/constants/userFeedConnectionTabSearchParam";

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
      borderColor="border"
      _hover={{ bg: "bg.emphasized" }}
      aria-label={`Insert ${placeholder.tag} placeholder. Preview: ${placeholder.content.slice(
        0,
        100,
      )}${placeholder.content.length > 100 ? "..." : ""}`}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        wordBreak="break-word"
      >
        <VStack align="start" gap={2} flex={1} w="full" mr={4}>
          <Code colorPalette="brand" fontSize="sm" fontWeight="bold" userSelect="text">
            {placeholder.tag}
          </Code>
          <Text
            fontSize="sm"
            color="fg.muted"
            fontStyle={placeholder.content.startsWith("[") ? "italic" : "normal"}
            textAlign="left"
            w="full"
            whiteSpace="normal"
            lineClamp={5}
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
          colorPalette="brand"
          variant="outline"
          onClick={() => handleSelectTag(placeholder.tag)}
          flexShrink={0}
          _focus={{ outline: "2px solid", outlineColor: "brand.focusRing" }}
        >
          Select
          <FaChevronRight />
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
  const { connection, userFeed } = useUserFeedConnectionContext();
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
      ph.content.toLowerCase().includes(searchTerm.toLowerCase()),
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
    [filteredPlaceholders, handleSelectTag],
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
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          onClose();
        }
      }}
      size="xl"
      scrollBehavior="inside"
      finalFocusEl={onCloseFocusRef ? () => onCloseFocusRef.current : undefined}
    >
      <DialogContent
        color="fg"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <DialogHeader borderBottom="1px solid" borderColor="border">
          <DialogTitle>Insert Placeholder</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody p={0}>
          <Box p={4} borderBottom="1px solid" borderColor="border">
            <Text fontSize="sm" color="fg.muted" mb={3}>
              Placeholders represent article content for the currently-selected article when being
              previewed or published. Select a placeholder to insert into your text content.
            </Text>
            <InputGroup startElement={<FaMagnifyingGlass color="fg.muted" aria-hidden />}>
              <Input
                ref={searchInputRef}
                placeholder="Search placeholders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!!error || !!isLoading}
                aria-label="Search placeholders"
                aria-describedby="search-results-count"
              />
            </InputGroup>
            {!isLoading && !error && (
              <Text
                id="search-results-count"
                fontSize="xs"
                color="fg.muted"
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
                <VStack gap={4}>
                  <Spinner color="text.link" size="lg" borderWidth="4px" aria-hidden="true" />
                  <Text color="fg.muted" fontWeight="medium">
                    Loading Placeholders...
                  </Text>
                </VStack>
              </Box>
            )}
            {!isLoading && error && (
              <Box p={6} textAlign="center" role="alert" aria-live="assertive">
                <VStack gap={4}>
                  <Text color="text.error" fontWeight="medium">
                    Failed to Load Placeholders
                  </Text>
                  <Text color="fg.muted" fontSize="sm" textAlign="center">
                    Placeholders are unavailable because the article data could not be loaded. Try
                    refreshing the page or refetching preview articles in the preview section.
                  </Text>
                </VStack>
              </Box>
            )}
            {!isLoading && !error && filteredPlaceholders.length === 0 && (
              <Box p={6} textAlign="center" role="status">
                <Text color="fg.muted" fontStyle="italic">
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
          <Box p={4} borderTopWidth="1px" borderColor="border" bg="bg.subtle">
            <HStack gap={2} justify="center" flexWrap="wrap">
              <Text fontSize="sm" color="fg.muted">
                Need to customize placeholder content?
              </Text>
              <ChakraLink
                asChild
                color="text.link"
                fontSize="sm"
                fontWeight="medium"
                display="inline-flex"
                alignItems="center"
                _hover={{ color: "text.link" }}
              >
                <Link
                  to={pages.userFeedConnection(
                    {
                      feedId: userFeed.id,
                      connectionId: connection.id,
                      connectionType: connection.key,
                    },
                    {
                      tab: UserFeedConnectionTabSearchParam.CustomPlaceholders,
                    },
                  )}
                >
                  Use Custom Placeholders
                  <FaUpRightFromSquare style={{ marginLeft: "0.25rem" }} />
                </Link>
              </ChakraLink>
            </HStack>
          </Box>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};

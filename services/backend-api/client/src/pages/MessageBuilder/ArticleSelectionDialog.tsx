import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  Button,
  Box,
  Spinner,
  Badge,
  FormLabel,
  FormControl,
} from "@chakra-ui/react";
import { SearchIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { ArticlePropertySelect } from "../../features/feedConnections/components/ArticlePropertySelect";
import { useUserFeedConnectionContext } from "../../contexts/UserFeedConnectionContext";
import { useUserFeedArticles } from "../../features/feed";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import { useDebounce } from "../../hooks/useDebounce"; // Adjust import path as needed

interface ArticleSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArticle: (articleId: string) => void;
  currentArticleId?: string;
  error?: string;
}

const ITEMS_PER_PAGE = 10;

export const ArticleSelectionDialog: React.FC<ArticleSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelectArticle,
  currentArticleId,
  error,
}) => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const { connection } = useUserFeedConnectionContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [displayProperty, setDisplayProperty] = useState<string>();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data, fetchStatus, status } = useUserFeedArticles({
    feedId: userFeed.id,
    data: {
      limit: ITEMS_PER_PAGE,
      formatOptions: articleFormatOptions,
      skip: (currentPage - 1) * ITEMS_PER_PAGE,
      selectProperties: [displayProperty || "title"],
      filters: {
        search: debouncedSearchQuery.trim() ? debouncedSearchQuery.trim() : undefined,
      },
    },
    disabled: !displayProperty || !isOpen,
  });
  const isLoading = status === "loading" || fetchStatus === "fetching";

  const totalArticles = data?.result.totalArticles || 0;
  const totalPages = Math.ceil(totalArticles / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const articles = data?.result.articles || [];

  const handleSelectArticle = (article: Record<string, string>) => {
    onSelectArticle(article.id);
    onClose();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getDisplayValue = (article: Record<string, string>) => {
    if (!displayProperty) {
      return "[No value]";
    }

    return article[displayProperty] || "[No value]";
  };

  // Reset search and pagination when modal closes or articles change
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setCurrentPage(1);
    }
  }, [isOpen]);

  // Reset to page 1 if current page exceeds available pages after filtering
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handleKeyDown = (e: React.KeyboardEvent, article: Record<string, string>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelectArticle(article);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent bg="gray.800" color="white" maxH="80vh" role="dialog">
        <ModalHeader
          borderBottom="1px solid"
          borderColor="gray.600"
          fontSize="lg"
          fontWeight="semibold"
        >
          Select Article
        </ModalHeader>
        <ModalCloseButton aria-label="Close article selection dialog" size="lg" />
        <ModalBody p={0}>
          {/* Search and Controls Section */}
          <Box p={4} borderBottom="1px solid" borderColor="gray.600" role="region">
            <Text fontSize="sm" color="gray.400" mb={3} id="article-selection-description">
              Select an article from the list below to preview. Choose a property to display and
              search within. Use Tab to navigate between controls and Enter or Space to select
              articles.
            </Text>
            <VStack spacing={4} align="stretch">
              <FormControl w="full" mt={2}>
                <FormLabel
                  fontSize="sm"
                  color="gray.400"
                  id="display-property-label"
                  as="label"
                  htmlFor="display-property-select"
                >
                  Display Property
                </FormLabel>
                <ArticlePropertySelect
                  customPlaceholders={connection.customPlaceholders || []}
                  value={displayProperty}
                  onChange={(v) => setDisplayProperty(v)}
                  placeholder="Select property to display..."
                  isInvalid={false}
                  ariaLabelledBy="display-property-label"
                  inputId="display-property-select"
                  isRequired={false}
                  invertBg
                />
              </FormControl>
              <FormControl w="full">
                <FormLabel
                  fontSize="sm"
                  color="gray.400"
                  mb={2}
                  as="label"
                  htmlFor="search-articles-input"
                >
                  Search Articles
                </FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="gray.400" aria-hidden="true" />
                  </InputLeftElement>
                  <Input
                    id="search-articles-input"
                    placeholder={displayProperty ? `Search by ${displayProperty}...` : "Search..."}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    bg="gray.700"
                    border="none"
                    aria-label={`Search articles by ${displayProperty}`}
                    aria-describedby="search-description"
                    aria-disabled={!displayProperty || !!error}
                  />
                </InputGroup>
                <Text id="search-description" fontSize="xs" color="gray.500" mt={1} srOnly>
                  Type to filter articles by the selected property. Results update automatically as
                  you type.
                </Text>
              </FormControl>
            </VStack>
          </Box>
          {/* Content Section */}
          <VStack spacing={0} align="stretch" aria-label="Article list">
            {/* Loading State */}
            {isLoading && (
              <Box
                p={6}
                textAlign="center"
                role="status"
                aria-live="polite"
                aria-label="Loading articles"
                bg="gray.800"
              >
                <VStack spacing={4}>
                  <Spinner color="blue.400" size="lg" thickness="4px" />
                  <Text color="gray.300" fontWeight="medium">
                    Loading Articles...
                  </Text>
                </VStack>
              </Box>
            )}
            {/* Error State */}
            {!isLoading && error && (
              <Box p={6} textAlign="center" role="alert" aria-live="assertive" aria-atomic="true">
                <VStack spacing={4}>
                  <Text color="red.400" fontWeight="medium">
                    Failed to Load Articles
                  </Text>
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    {error}
                  </Text>
                </VStack>
              </Box>
            )}
            {/* Empty State */}
            {!isLoading && !error && articles.length === 0 && (
              <Box p={6} textAlign="center" role="status" aria-live="polite">
                <Text color="gray.400" fontStyle="italic">
                  {debouncedSearchQuery
                    ? `No articles found matching '${debouncedSearchQuery}'`
                    : "No articles available."}
                </Text>
              </Box>
            )}
            {/* Articles List */}
            {status === "success" && !error && articles.length > 0 && (
              <>
                {/* Articles List Header */}
                <VStack
                  spacing={0}
                  align="stretch"
                  role="list"
                  maxHeight={400}
                  bg="gray.800"
                  h="100%"
                  overflow="auto"
                  hidden={fetchStatus === "fetching"}
                  aria-label={`Articles ${startIndex + 1} to ${Math.min(
                    startIndex + ITEMS_PER_PAGE,
                    totalArticles,
                  )} of ${totalArticles}`}
                >
                  {articles.map((article, index) => {
                    const isSelected = article.id === currentArticleId;

                    return (
                      <Button
                        key={article.id}
                        role="listitem"
                        variant="ghost"
                        justifyContent="space-between"
                        p={4}
                        h="auto"
                        minH="auto"
                        borderRadius={0}
                        borderBottom={
                          index < Math.min(ITEMS_PER_PAGE - 1, articles.length - 1)
                            ? "1px solid"
                            : undefined
                        }
                        borderColor="gray.600"
                        bg="transparent"
                        _hover={{
                          bg: "gray.700",
                        }}
                        _focus={{
                          bg: "gray.700",
                          outline: "2px solid",
                          outlineColor: "blue.400",
                          outlineOffset: "-2px",
                        }}
                        onClick={() => handleSelectArticle(article)}
                        onKeyDown={(e) => handleKeyDown(e, article)}
                      >
                        <VStack align="start" spacing={isSelected ? 2 : 0} flex={1} w="full">
                          {isSelected && (
                            <HStack spacing={2} aria-hidden="true">
                              <Badge size="sm" colorScheme="blue" fontSize="xs">
                                Currently selected
                              </Badge>
                            </HStack>
                          )}
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            textAlign="left"
                            w="full"
                            wordBreak="break-word"
                            whiteSpace="pre-wrap"
                            noOfLines={displayProperty === "content" ? 4 : 2}
                            fontStyle={
                              getDisplayValue(article).startsWith("[") ? "italic" : "normal"
                            }
                          >
                            {getDisplayValue(article)}
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
                    );
                  })}
                </VStack>
                {/* Pagination Section */}
                {totalPages > 1 && (
                  <Box p={4} borderTop="1px solid" borderColor="gray.600" bg="gray.800">
                    <HStack justify="space-between" align="center" w="full">
                      {/* Article Count Info - Left Side */}
                      <Text fontSize="sm" color="gray.400" aria-live="polite">
                        Showing {startIndex + 1}-
                        {Math.min(startIndex + ITEMS_PER_PAGE, totalArticles)} of {totalArticles}
                        {debouncedSearchQuery && (
                          <Text as="span" color="gray.500">
                            {" "}
                            (filtered)
                          </Text>
                        )}
                      </Text>
                      {/* Pagination Controls - Right Side */}
                      <HStack spacing={2}>
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="gray"
                          aria-disabled={currentPage === 1 || fetchStatus === "fetching"}
                          onClick={() => {
                            if (currentPage === 1 || fetchStatus === "fetching") {
                              return;
                            }

                            handlePageChange(currentPage - 1);
                          }}
                          aria-label={`Go to previous page. Currently on page ${currentPage} of ${totalPages}`}
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="gray"
                          aria-disabled={currentPage === totalPages || fetchStatus === "fetching"}
                          onClick={() => {
                            if (currentPage === totalPages || fetchStatus === "fetching") {
                              return;
                            }

                            handlePageChange(currentPage + 1);
                          }}
                          aria-label={`Go to next page. Currently on page ${currentPage} of ${totalPages}`}
                        >
                          Next
                        </Button>
                      </HStack>
                    </HStack>
                  </Box>
                )}
              </>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

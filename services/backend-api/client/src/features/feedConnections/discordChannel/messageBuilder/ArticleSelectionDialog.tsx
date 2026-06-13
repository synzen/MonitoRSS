import React, { useState } from "react";
import {
  VStack,
  HStack,
  Input,
  InputGroup,
  Text,
  Button,
  Box,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { FaMagnifyingGlass, FaChevronRight } from "react-icons/fa6";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { ArticlePropertySelect } from "../connection/components/ArticlePropertySelect";
import {
  useUserFeedConnectionContext,
  useUserFeedArticles,
  useUserFeedContext,
} from "@/features/feed";
import { useDebounce } from "@/hooks/useDebounce"; // Adjust import path as needed

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
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          onClose();
        }
      }}
      size="xl"
    >
      <DialogContent color="fg" maxH="80vh" role="dialog">
        <DialogHeader
          borderBottomWidth="1px"
          borderColor="border"
          fontSize="lg"
          fontWeight="semibold"
        >
          <DialogTitle>Select Article</DialogTitle>
          <DialogCloseTrigger aria-label="Close article selection dialog" />
        </DialogHeader>
        <DialogBody p={0}>
          {/* Search and Controls Section */}
          <Box p={4} borderBottomWidth="1px" borderColor="border" role="region">
            <Text fontSize="sm" color="fg.muted" mb={3} id="article-selection-description">
              Select an article from the list below to preview. Choose a property to display and
              search within. Use Tab to navigate between controls and Enter or Space to select
              articles.
            </Text>
            <VStack gap={4} align="stretch">
              <Field label="Display Property" w="full" mt={2}>
                <ArticlePropertySelect
                  customPlaceholders={connection.customPlaceholders || []}
                  value={displayProperty}
                  onChange={(v) => setDisplayProperty(v)}
                  placeholder="Select property to display..."
                  isInvalid={false}
                  ariaLabelledBy="display-property-label"
                  inputId="display-property-select"
                  isRequired={false}
                />
              </Field>
              <Field label="Search Articles" w="full">
                <InputGroup
                  startElement={<FaMagnifyingGlass color="fg.muted" aria-hidden />}
                  w="full"
                >
                  <Input
                    id="search-articles-input"
                    placeholder={displayProperty ? `Search by ${displayProperty}...` : "Search..."}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    aria-label={`Search articles by ${displayProperty}`}
                    aria-describedby="search-description"
                    aria-disabled={!displayProperty || !!error}
                  />
                </InputGroup>
                <Text id="search-description" fontSize="xs" color="fg.muted" mt={1} srOnly>
                  Type to filter articles by the selected property. Results update automatically as
                  you type.
                </Text>
              </Field>
            </VStack>
          </Box>
          {/* Content Section */}
          <VStack gap={0} align="stretch" aria-label="Article list">
            {/* Loading State */}
            {isLoading && (
              <Box
                p={6}
                textAlign="center"
                role="status"
                aria-live="polite"
                aria-label="Loading articles"
                bg="bg.panel"
              >
                <VStack gap={4}>
                  <Spinner color="text.link" size="lg" borderWidth="4px" />
                  <Text color="fg.muted" fontWeight="medium">
                    Loading Articles...
                  </Text>
                </VStack>
              </Box>
            )}
            {/* Error State */}
            {!isLoading && error && (
              <Box p={6} textAlign="center" role="alert" aria-live="assertive" aria-atomic="true">
                <VStack gap={4}>
                  <Text color="text.error" fontWeight="medium">
                    Failed to Load Articles
                  </Text>
                  <Text color="fg.muted" fontSize="sm" textAlign="center">
                    {error}
                  </Text>
                </VStack>
              </Box>
            )}
            {/* Empty State */}
            {!isLoading && !error && articles.length === 0 && (
              <Box p={6} textAlign="center" role="status" aria-live="polite">
                <Text color="fg.muted" fontStyle="italic">
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
                  gap={0}
                  align="stretch"
                  role="list"
                  maxHeight={400}
                  bg="bg.panel"
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
                        borderColor="border"
                        bg="transparent"
                        _hover={{
                          bg: "bg.emphasized",
                        }}
                        _focus={{
                          bg: "bg.emphasized",
                          outline: "2px solid",
                          outlineColor: "brand.focusRing",
                          outlineOffset: "-2px",
                        }}
                        onClick={() => handleSelectArticle(article)}
                        onKeyDown={(e) => handleKeyDown(e, article)}
                      >
                        <VStack align="start" gap={isSelected ? 2 : 0} flex={1} w="full">
                          {isSelected && (
                            <HStack gap={2} aria-hidden="true">
                              <Badge size="sm" colorPalette="brand" fontSize="xs">
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
                            lineClamp={displayProperty === "content" ? 4 : 2}
                            fontStyle={
                              getDisplayValue(article).startsWith("[") ? "italic" : "normal"
                            }
                          >
                            {getDisplayValue(article)}
                          </Text>
                        </VStack>
                        <FaChevronRight
                          color="fg.muted"
                          fontSize="lg"
                          style={{ marginLeft: "0.5rem", flexShrink: 0 }}
                          aria-hidden
                        />
                      </Button>
                    );
                  })}
                </VStack>
                {/* Pagination Section */}
                {totalPages > 1 && (
                  <Box p={4} borderTop="1px solid" borderColor="border" bg="bg.panel">
                    <HStack justify="space-between" align="center" w="full">
                      {/* Article Count Info - Left Side */}
                      <Text fontSize="sm" color="fg.muted" aria-live="polite">
                        Showing {startIndex + 1}-
                        {Math.min(startIndex + ITEMS_PER_PAGE, totalArticles)} of {totalArticles}
                        {debouncedSearchQuery && (
                          <Text as="span" color="fg.muted">
                            {" "}
                            (filtered)
                          </Text>
                        )}
                      </Text>
                      {/* Pagination Controls - Right Side */}
                      <HStack gap={2}>
                        <Button
                          size="sm"
                          variant="outline"
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
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};

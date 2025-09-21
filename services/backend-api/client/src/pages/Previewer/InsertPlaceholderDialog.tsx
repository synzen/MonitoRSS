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
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";

interface MergeTag {
  tag: string;
  content: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectTag: (tag: string) => void;
  currentArticle: {
    title?: string;
    description?: string;
    url?: string;
    author?: string;
    publishedAt?: string;
    feedTitle?: string;
  };
}

export const InsertPlaceholderDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectTag,
  currentArticle,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");

  const placeholders: MergeTag[] = [
    {
      tag: "{{title}}",
      content: currentArticle.title || "[No title]",
    },
    {
      tag: "{{description}}",
      content: currentArticle.description || "[No description]",
    },
    {
      tag: "{{url}}",
      content: currentArticle.url || "[No URL]",
    },
    {
      tag: "{{author}}",
      content: currentArticle.author || "[No author]",
    },
    {
      tag: "{{date}}",
      content: currentArticle.publishedAt
        ? new Date(currentArticle.publishedAt).toLocaleDateString()
        : "[No date]",
    },
    {
      tag: "{{feed}}",
      content: currentArticle.feedTitle || "[No feed title]",
    },
  ];

  const filteredPlaceholders = placeholders.filter(
    (ph) =>
      ph.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ph.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectTag = (tag: string) => {
    onSelectTag(tag);
    onClose();
  };

  // Reset search when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent
        bg="gray.800"
        color="white"
        maxH="80vh"
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
              Select a placeholder to insert into your text content. The placeholder will be
              replaced with the actual article content when being previewed or published.
            </Text>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search placeholders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="gray.700"
                border="1px solid"
                borderColor="gray.600"
                _focus={{ borderColor: "blue.400" }}
                _placeholder={{ color: "gray.500" }}
              />
            </InputGroup>
          </Box>
          <VStack spacing={0} align="stretch" maxH="60vh" overflowY="auto">
            {filteredPlaceholders.length === 0 ? (
              <Box p={6} textAlign="center">
                <Text color="gray.400" fontStyle="italic">
                  No placeholders found matching &apos;{searchTerm}&apos;
                </Text>
              </Box>
            ) : (
              filteredPlaceholders.map((ph, index) => (
                <Button
                  key={ph.tag}
                  variant="ghost"
                  justifyContent="flex-start"
                  p={4}
                  h="auto"
                  minH="auto"
                  borderRadius={0}
                  borderBottom={index < filteredPlaceholders.length - 1 ? "1px solid" : undefined}
                  borderColor="gray.600"
                  _hover={{ bg: "gray.700" }}
                  onClick={() => handleSelectTag(ph.tag)}
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
                    >
                      {ph.content}
                    </Text>
                  </VStack>
                </Button>
              ))
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

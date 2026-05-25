import React, { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Image,
  Input,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  SimpleGrid,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
  VisuallyHidden,
  VStack,
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { useDiscordServerEmojis } from "../../../features/discordServers/hooks";
import { InlineErrorAlert } from "../../../components/InlineErrorAlert";
import emojis from "../../../constants/emojis";
import { ButtonEmoji } from "../types";

interface EmojiPickerProps {
  value?: ButtonEmoji;
  onChange: (emoji: ButtonEmoji | undefined) => void;
  guildId?: string;
}

const CATEGORIES = [
  { key: "people", label: "People", icon: "😀" },
  { key: "nature", label: "Nature", icon: "🌿" },
  { key: "food", label: "Food", icon: "🍔" },
  { key: "activity", label: "Activity", icon: "⚽" },
  { key: "travel", label: "Travel", icon: "✈️" },
  { key: "objects", label: "Objects", icon: "💡" },
] as const;

type EmojiCategory = (typeof CATEGORIES)[number]["key"];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ value, onChange, guildId }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<EmojiCategory>("people");
  const [announcement, setAnnouncement] = useState("");

  const {
    data: serverEmojisData,
    status,
    error,
    refetch,
  } = useDiscordServerEmojis({
    serverId: guildId,
    disabled: !isOpen,
  });

  const filteredDefaultEmojis = useMemo(() => {
    const categoryEmojis = emojis[activeCategory] || [];
    if (!search.trim()) return categoryEmojis;
    const term = search.toLowerCase();
    return categoryEmojis.filter((e) => e.names.some((n: string) => n.includes(term)));
  }, [activeCategory, search]);

  const filteredServerEmojis = useMemo(() => {
    if (!serverEmojisData?.results) return [];
    if (!search.trim()) return serverEmojisData.results;
    const term = search.toLowerCase();
    return serverEmojisData.results.filter((e) => e.name.toLowerCase().includes(term));
  }, [serverEmojisData, search]);

  const handleSelectDefault = (emoji: { names: readonly string[]; surrogates: string }) => {
    const selected: ButtonEmoji = { name: emoji.surrogates };
    onChange(selected);
    setAnnouncement(`Selected ${emoji.names[0].replace(/_/g, " ")} emoji`);
    onClose();
    setSearch("");
  };

  const handleSelectServer = (emoji: { id: string; name: string; animated: boolean }) => {
    const selected: ButtonEmoji = {
      id: emoji.id,
      name: emoji.name,
      animated: emoji.animated,
    };
    onChange(selected);
    setAnnouncement(`Selected ${emoji.name.replace(/_/g, " ")} emoji`);
    onClose();
    setSearch("");
  };

  const handleClear = () => {
    onChange(undefined);
    setAnnouncement("Emoji removed");
  };

  const triggerLabel = value
    ? `Change emoji, currently ${value.name.replace(/_/g, " ")}`
    : "Choose emoji for button";

  return (
    <HStack spacing={2}>
      <Popover
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={() => {
          onClose();
          setSearch("");
        }}
        initialFocusRef={searchRef}
        placement="bottom-start"
        isLazy
      >
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            aria-label={triggerLabel}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            borderColor="gray.600"
            color="gray.200"
            _hover={{ bg: "gray.600" }}
          >
            {value ? (
              <HStack spacing={1}>
                {value.id ? (
                  <Image
                    src={`https://cdn.discordapp.com/emojis/${value.id}.${
                      value.animated ? "gif" : "png"
                    }`}
                    boxSize="18px"
                    alt={value.name}
                  />
                ) : (
                  <Text as="span" fontSize="16px">
                    {value.name}
                  </Text>
                )}
                <Text as="span" fontSize="sm">
                  {value.id ? value.name : ""}
                </Text>
              </HStack>
            ) : (
              "Add Emoji"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          role="dialog"
          aria-label="Emoji picker"
          bg="gray.800"
          borderColor="gray.600"
          w="320px"
        >
          <PopoverBody p={3}>
            <VisuallyHidden aria-live="assertive" aria-atomic="true">
              {announcement}
            </VisuallyHidden>

            <Tabs variant="soft-rounded" size="sm">
              <TabList mb={2}>
                <Tab fontSize="xs" color="gray.300" _selected={{ color: "white", bg: "blue.600" }}>
                  Default
                </Tab>
                <Tab fontSize="xs" color="gray.300" _selected={{ color: "white", bg: "blue.600" }}>
                  Server
                </Tab>
              </TabList>

              <Input
                ref={searchRef}
                placeholder="Search emojis..."
                size="sm"
                mb={2}
                bg="gray.700"
                borderColor="gray.600"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search emojis"
              />

              <TabPanels>
                <TabPanel p={0}>
                  <DefaultEmojiTab
                    categories={CATEGORIES}
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
                    emojis={filteredDefaultEmojis}
                    onSelect={handleSelectDefault}
                    search={search}
                  />
                </TabPanel>
                <TabPanel p={0}>
                  <ServerEmojiTab
                    emojis={filteredServerEmojis}
                    status={status}
                    error={error}
                    onSelect={handleSelectServer}
                    onRetry={() => refetch()}
                    search={search}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </PopoverBody>
        </PopoverContent>
      </Popover>

      {value && (
        <IconButton
          aria-label="Remove selected emoji"
          icon={<CloseIcon />}
          size="sm"
          variant="ghost"
          colorScheme="red"
          minW="24px"
          minH="24px"
          onClick={handleClear}
        />
      )}
    </HStack>
  );
};

interface DefaultEmojiTabProps {
  categories: typeof CATEGORIES;
  activeCategory: EmojiCategory;
  onCategoryChange: (category: EmojiCategory) => void;
  emojis: ReadonlyArray<{ names: readonly string[]; surrogates: string }>;
  onSelect: (emoji: { names: readonly string[]; surrogates: string }) => void;
  search: string;
}

const DefaultEmojiTab: React.FC<DefaultEmojiTabProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  emojis: emojiList,
  onSelect,
  search,
}) => {
  return (
    <VStack align="stretch" spacing={0}>
      <HStack
        role="toolbar"
        aria-label="Filter by emoji group"
        spacing={1}
        borderBottom="1px solid"
        borderColor="gray.600"
        pb={2}
        mb={2}
      >
        {categories.map((cat) => (
          <Button
            key={cat.key}
            size="xs"
            variant="ghost"
            aria-label={cat.label}
            aria-pressed={activeCategory === cat.key}
            onClick={() => onCategoryChange(cat.key)}
            bg={activeCategory === cat.key ? "gray.600" : "transparent"}
            fontSize="lg"
            px={1.5}
            minW="32px"
            h="32px"
            borderRadius="md"
            _hover={{ bg: "gray.600" }}
          >
            {cat.icon}
          </Button>
        ))}
      </HStack>

      {emojiList.length === 0 ? (
        <Text color="gray.300" fontSize="sm" textAlign="center" py={4}>
          {search ? "No emojis match your search" : "No emojis in this category"}
        </Text>
      ) : (
        <Box
          role="listbox"
          aria-label="Default emojis"
          maxH="240px"
          overflowY="scroll"
          sx={{
            scrollbarWidth: "thin",
            scrollbarColor: "#718096 #2D3748",
            "&::-webkit-scrollbar": { width: "8px" },
            "&::-webkit-scrollbar-track": { bg: "#2D3748", borderRadius: "4px" },
            "&::-webkit-scrollbar-thumb": { bg: "#718096", borderRadius: "4px" },
          }}
        >
          <SimpleGrid columns={8} spacing={0}>
            {emojiList.map((emoji) => (
              <Button
                key={emoji.surrogates}
                role="option"
                aria-label={emoji.names[0].replace(/_/g, " ")}
                title={emoji.names[0].replace(/_/g, " ")}
                variant="ghost"
                size="sm"
                fontSize="xl"
                p={0}
                minW="36px"
                h="36px"
                onClick={() => onSelect(emoji)}
                _hover={{ bg: "gray.600" }}
                borderRadius="md"
              >
                {emoji.surrogates}
              </Button>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
};

interface ServerEmojiTabProps {
  emojis: Array<{ id: string; name: string; animated: boolean; imageUrl: string }>;
  status: string;
  error: any;
  onSelect: (emoji: { id: string; name: string; animated: boolean }) => void;
  onRetry: () => void;
  search: string;
}

const ServerEmojiTab: React.FC<ServerEmojiTabProps> = ({
  emojis: emojiList,
  status,
  error,
  onSelect,
  onRetry,
  search,
}) => {
  if (status === "pending") {
    return (
      <SimpleGrid columns={4} spacing={2} aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} h="48px" borderRadius="md" />
        ))}
      </SimpleGrid>
    );
  }

  if (error) {
    return (
      <VStack spacing={2} py={4}>
        <InlineErrorAlert title="Could not load server emojis" />
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      </VStack>
    );
  }

  if (emojiList.length === 0) {
    if (search) {
      return (
        <Text color="gray.300" fontSize="sm" textAlign="center" py={4}>
          No server emojis match your search
        </Text>
      );
    }

    return (
      <VStack py={4} spacing={1}>
        <Text color="gray.300" fontSize="sm" textAlign="center">
          No custom emojis
        </Text>
        <Text color="gray.400" fontSize="xs" textAlign="center">
          This server doesn&apos;t have any custom emojis. You can add them in Discord Server
          Settings.
        </Text>
      </VStack>
    );
  }

  return (
    <Box maxH="240px" overflowY="auto" role="listbox" aria-label="Server emojis">
      <SimpleGrid columns={4} spacing={2}>
        {emojiList.map((emoji) => (
          <Button
            key={emoji.id}
            role="option"
            aria-label={emoji.name.replace(/_/g, " ")}
            title={emoji.name}
            variant="ghost"
            size="sm"
            h="auto"
            p={2}
            onClick={() => onSelect(emoji)}
            _hover={{ bg: "gray.600" }}
            borderRadius="md"
            flexDirection="column"
          >
            <Image
              src={emoji.animated ? emoji.imageUrl.replace(".gif", ".png") : emoji.imageUrl}
              boxSize="32px"
              alt={emoji.name}
              onMouseEnter={(e) => {
                if (emoji.animated) {
                  (e.target as HTMLImageElement).src = emoji.imageUrl;
                }
              }}
              onMouseLeave={(e) => {
                if (emoji.animated) {
                  (e.target as HTMLImageElement).src = emoji.imageUrl.replace(".gif", ".png");
                }
              }}
            />
            <Text fontSize="11px" color="gray.300" mt={1} noOfLines={1} maxW="60px">
              {emoji.animated ? "▶ " : ""}
              {emoji.name}
            </Text>
          </Button>
        ))}
      </SimpleGrid>
    </Box>
  );
};

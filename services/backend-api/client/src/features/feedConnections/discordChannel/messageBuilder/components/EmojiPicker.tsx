import React, { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Image,
  Input,
  SimpleGrid,
  Skeleton,
  Tabs,
  Text,
  VisuallyHidden,
  VStack,
} from "@chakra-ui/react";
import { FaXmark } from "react-icons/fa6";
import { PopoverBody, PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { useDiscordServerEmojis } from "@/features/discordServers";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import emojis from "@/constants/emojis";
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
  const [open, setOpen] = useState(false);
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
    disabled: !open,
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
    setOpen(false);
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
    setOpen(false);
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
    <HStack gap={2}>
      <PopoverRoot
        open={open}
        onOpenChange={(e) => {
          setOpen(e.open);

          if (!e.open) {
            setSearch("");
          }
        }}
        positioning={{ placement: "bottom-start" }}
        initialFocusEl={() => searchRef.current}
        lazyMount
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            colorPalette="brand"
            size="sm"
            aria-label={triggerLabel}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            {value ? (
              <HStack gap={1}>
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
        <PopoverContent role="dialog" aria-label="Emoji picker" borderColor="border" w="320px">
          <PopoverBody p={3}>
            <VisuallyHidden aria-live="assertive" aria-atomic="true">
              {announcement}
            </VisuallyHidden>
            <Tabs.Root defaultValue="default" variant="subtle" size="sm">
              <Tabs.List mb={2}>
                <Tabs.Trigger
                  value="default"
                  fontSize="xs"
                  color="fg.muted"
                  _selected={{ color: "fg", bg: "brandSolid" }}
                >
                  Default
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="server"
                  fontSize="xs"
                  color="fg.muted"
                  _selected={{ color: "fg", bg: "brandSolid" }}
                >
                  Server
                </Tabs.Trigger>
              </Tabs.List>
              <Input
                ref={searchRef}
                placeholder="Search emojis..."
                size="sm"
                mb={2}
                borderColor="border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search emojis"
              />
              <Tabs.Content value="default" p={0}>
                <DefaultEmojiTab
                  categories={CATEGORIES}
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                  emojis={filteredDefaultEmojis}
                  onSelect={handleSelectDefault}
                  search={search}
                />
              </Tabs.Content>
              <Tabs.Content value="server" p={0}>
                <ServerEmojiTab
                  emojis={filteredServerEmojis}
                  status={status}
                  error={error}
                  onSelect={handleSelectServer}
                  onRetry={() => refetch()}
                  search={search}
                />
              </Tabs.Content>
            </Tabs.Root>
          </PopoverBody>
        </PopoverContent>
      </PopoverRoot>
      {value && (
        <IconButton
          aria-label="Remove selected emoji"
          size="sm"
          variant="ghost"
          colorPalette="red"
          minW="24px"
          minH="24px"
          onClick={handleClear}
        >
          <FaXmark />
        </IconButton>
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
    <VStack align="stretch" gap={0}>
      <HStack
        role="toolbar"
        aria-label="Filter by emoji group"
        gap={1}
        borderBottom="1px solid"
        borderColor="border"
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
            bg={activeCategory === cat.key ? "bg.emphasized" : "transparent"}
            borderWidth="1px"
            borderColor={activeCategory === cat.key ? "brandSolid" : "transparent"}
            fontSize="lg"
            px={1.5}
            minW="32px"
            h="32px"
            borderRadius="l3"
            _hover={{ bg: "bg.emphasized" }}
          >
            {cat.icon}
          </Button>
        ))}
      </HStack>
      {emojiList.length === 0 ? (
        <Text color="fg.muted" fontSize="sm" textAlign="center" py={4}>
          {search ? "No emojis match your search" : "No emojis in this category"}
        </Text>
      ) : (
        <Box
          role="listbox"
          aria-label="Default emojis"
          maxH="240px"
          overflowY="scroll"
          css={{
            scrollbarWidth: "thin",
            scrollbarColor:
              "var(--chakra-colors-border-emphasized) var(--chakra-colors-bg-emphasized)",
            "&::-webkit-scrollbar": { width: "8px" },
            "&::-webkit-scrollbar-track": {
              bg: "var(--chakra-colors-bg-emphasized)",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb": {
              bg: "var(--chakra-colors-border-emphasized)",
              borderRadius: "4px",
            },
          }}
        >
          <SimpleGrid columns={8} gap={0}>
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
                _hover={{ bg: "bg.emphasized" }}
                borderRadius="l3"
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
      <SimpleGrid columns={4} gap={2} aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key -- fixed-length loading skeletons
          <Skeleton key={i} h="48px" borderRadius="l3" />
        ))}
      </SimpleGrid>
    );
  }

  if (error) {
    return (
      <VStack gap={2} py={4}>
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
        <Text color="fg.muted" fontSize="sm" textAlign="center" py={4}>
          No server emojis match your search
        </Text>
      );
    }

    return (
      <VStack py={4} gap={1}>
        <Text color="fg.muted" fontSize="sm" textAlign="center">
          No custom emojis
        </Text>
        <Text color="fg.muted" fontSize="xs" textAlign="center">
          This server doesn&apos;t have any custom emojis. You can add them in Discord Server
          Settings.
        </Text>
      </VStack>
    );
  }

  return (
    <Box
      maxH="240px"
      overflowY="auto"
      role="listbox"
      aria-label="Server emojis"
      css={{
        scrollbarWidth: "thin",
        scrollbarColor: "var(--chakra-colors-border-emphasized) var(--chakra-colors-bg-emphasized)",
        "&::-webkit-scrollbar": { width: "8px" },
        "&::-webkit-scrollbar-track": {
          bg: "var(--chakra-colors-bg-emphasized)",
          borderRadius: "4px",
        },
        "&::-webkit-scrollbar-thumb": {
          bg: "var(--chakra-colors-border-emphasized)",
          borderRadius: "4px",
        },
      }}
    >
      <SimpleGrid columns={4} gap={2}>
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
            _hover={{ bg: "bg.emphasized" }}
            borderRadius="l3"
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
            <Text fontSize="11px" color="fg.muted" mt={1} lineClamp={1} maxW="60px">
              {emoji.animated ? "▶ " : ""}
              {emoji.name}
            </Text>
          </Button>
        ))}
      </SimpleGrid>
    </Box>
  );
};

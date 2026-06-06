import React from "react";
import {
  VStack,
  Text,
  Button,
  Box,
  Input,
  InputGroup,
  Spinner,
  HStack,
  SimpleGrid,
  IconButton,
} from "@chakra-ui/react";
import { FaArrowLeft, FaAt, FaChevronRight, FaMagnifyingGlass } from "react-icons/fa6";
import { FaHashtag, FaBullhorn, FaComments } from "react-icons/fa";
import { Virtuoso } from "react-virtuoso";
import {
  useDiscordServerRoles,
  useDiscordServerMembers,
  useDiscordServerChannels,
  GetDiscordChannelType,
} from "@/features/discordServers";
import { useDebounce } from "@/hooks";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";

type MentionType = "role" | "user" | "channel";

export interface SelectedMention {
  id: string;
  type: MentionType;
  text: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelected: (mention: SelectedMention) => void;
  onCloseFocusRef?: React.RefObject<any> | undefined;
  guildId: string;
  excludeChannels?: boolean;
}

interface RoleItemProps {
  role: { id: string; name?: string; color: string };
  index: number;
  totalCount: number;
  onInsert: (mention: SelectedMention) => void;
  guildId: string;
}

const RoleItem: React.FC<RoleItemProps> = ({ role, index, totalCount, onInsert, guildId }) => {
  const isEveryoneRole = role.id === guildId;
  const mentionText = isEveryoneRole ? "@everyone" : `<@&${role.id}>`;
  const displayName = isEveryoneRole ? "@everyone" : `@${role.name || "unknown"}`;

  return (
    <Box
      p={4}
      w="100%"
      borderRadius={0}
      borderBottomWidth={index < totalCount - 1 ? "1px" : undefined}
      borderColor="border"
      _hover={{ bg: "bg.emphasized" }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <HStack gap={3}>
          <Box w={3} h={3} borderRadius="full" bg={role.color || "fg.muted"} flexShrink={0} />
          <Text fontSize="sm" fontWeight="medium">
            {displayName}
          </Text>
        </HStack>
        <Button
          size="sm"
          colorPalette="brand"
          variant="outline"
          onClick={() => onInsert({ id: role.id, type: "role", text: mentionText })}
          flexShrink={0}
        >
          Insert
          <FaChevronRight />
        </Button>
      </Box>
    </Box>
  );
};

interface UserItemProps {
  user: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  index: number;
  totalCount: number;
  onInsert: (mention: SelectedMention) => void;
}

const UserItem: React.FC<UserItemProps> = ({ user, index, totalCount, onInsert }) => {
  return (
    <Box
      p={4}
      w="100%"
      borderRadius={0}
      borderBottomWidth={index < totalCount - 1 ? "1px" : undefined}
      borderColor="border"
      _hover={{ bg: "bg.emphasized" }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <HStack gap={3}>
          <Avatar size="sm" name={user.username} src={user.avatarUrl || undefined} />
          <VStack align="start" gap={0}>
            <Text fontSize="sm" fontWeight="medium">
              @{user.displayName || user.username}
            </Text>
            {user.displayName && user.displayName !== user.username && (
              <Text fontSize="xs" color="fg.muted">
                {user.username}
              </Text>
            )}
          </VStack>
        </HStack>
        <Button
          size="sm"
          colorPalette="brand"
          variant="outline"
          onClick={() => onInsert({ id: user.id, type: "user", text: `<@${user.id}>` })}
          flexShrink={0}
        >
          Insert
          <FaChevronRight />
        </Button>
      </Box>
    </Box>
  );
};

interface ChannelItemProps {
  channel: {
    id: string;
    name: string;
    type?: string | null;
    category?: { name: string } | null;
  };
  index: number;
  totalCount: number;
  onInsert: (mention: SelectedMention) => void;
}

const getChannelIcon = (type?: string | null) => {
  switch (type) {
    case "announcement":
      return <Box as={FaBullhorn} color="fg.muted" fontSize="sm" />;
    case "forum":
      return <Box as={FaComments} color="fg.muted" fontSize="sm" />;
    case "text":
    default:
      return <Box as={FaHashtag} color="fg.muted" fontSize="sm" />;
  }
};

const ChannelItem: React.FC<ChannelItemProps> = ({ channel, index, totalCount, onInsert }) => {
  return (
    <Box
      p={4}
      w="100%"
      borderRadius={0}
      borderBottomWidth={index < totalCount - 1 ? "1px" : undefined}
      borderColor="border"
      _hover={{ bg: "bg.emphasized" }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <VStack align="start" gap={0}>
          <HStack gap={2}>
            {getChannelIcon(channel.type)}
            <Text fontSize="sm" fontWeight="medium">
              {channel.name}
            </Text>
          </HStack>
          {channel.category?.name && (
            <Text fontSize="xs" color="fg.muted" ml={6}>
              {channel.category.name}
            </Text>
          )}
        </VStack>
        <Button
          size="sm"
          colorPalette="brand"
          variant="outline"
          onClick={() => onInsert({ id: channel.id, type: "channel", text: `<#${channel.id}>` })}
          flexShrink={0}
        >
          Insert
          <FaChevronRight />
        </Button>
      </Box>
    </Box>
  );
};

export const InsertMentionDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelected,
  onCloseFocusRef,
  guildId,
  excludeChannels,
}) => {
  const [step, setStep] = React.useState<"type-select" | "entity-select">("type-select");
  const [selectedType, setSelectedType] = React.useState<MentionType | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Refs for type-select buttons to restore focus on back navigation
  const roleButtonRef = React.useRef<HTMLButtonElement>(null);
  const userButtonRef = React.useRef<HTMLButtonElement>(null);
  const channelButtonRef = React.useRef<HTMLButtonElement>(null);

  const debouncedSearch = useDebounce(searchTerm, 500);

  // Fetch roles
  const {
    data: rolesData,
    error: rolesError,
    isFetching: isFetchingRoles,
  } = useDiscordServerRoles({
    serverId: guildId,
    disabled: !isOpen || selectedType !== "role",
  });

  // Fetch members (server-side search)
  const {
    data: membersData,
    error: membersError,
    isFetching: isFetchingMembers,
  } = useDiscordServerMembers({
    serverId: guildId,
    disabled: !isOpen || selectedType !== "user" || !debouncedSearch,
    data: {
      limit: 25,
      search: debouncedSearch,
    },
  });

  // Fetch channels (all types for mentions)
  const {
    data: channelsData,
    error: channelsError,
    isFetching: isFetchingChannels,
  } = useDiscordServerChannels({
    serverId: guildId,
    types: [GetDiscordChannelType.All],
  });

  // Filter roles/channels client-side
  const filteredRoles = React.useMemo(() => {
    if (!rolesData?.results) return [];
    if (!searchTerm) return rolesData.results;

    return rolesData.results.filter((r) =>
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [rolesData, searchTerm]);

  const filteredChannels = React.useMemo(() => {
    if (!channelsData?.results) return [];

    // Filter out categories and voice channels (not mentionable)
    const mentionableChannels = channelsData.results.filter(
      (c) => c.type !== "category" && c.type !== "voice",
    );

    if (!searchTerm) return mentionableChannels;

    return mentionableChannels.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [channelsData, searchTerm]);

  const handleTypeSelect = (type: MentionType) => {
    setSelectedType(type);
    setStep("entity-select");
    setSearchTerm("");
  };

  const handleBack = () => {
    const previousType = selectedType;
    setStep("type-select");
    setSelectedType(null);
    setSearchTerm("");

    // Restore focus to the button that was clicked
    setTimeout(() => {
      if (previousType === "role") {
        roleButtonRef.current?.focus();
      } else if (previousType === "user") {
        userButtonRef.current?.focus();
      } else if (previousType === "channel") {
        channelButtonRef.current?.focus();
      }
    }, 0);
  };

  const handleInsert = React.useCallback(
    (mention: SelectedMention) => {
      onSelected(mention);
      onClose();
    },
    [onSelected, onClose],
  );

  // Reset state when modal closes/opens
  React.useEffect(() => {
    if (!isOpen) {
      setStep("type-select");
      setSelectedType(null);
      setSearchTerm("");
    }
  }, [isOpen]);

  // Focus search input when entering entity-select step
  React.useEffect(() => {
    if (step === "entity-select" && isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [step, isOpen]);

  const renderRoleItem = React.useCallback(
    (index: number) => (
      <RoleItem
        key={filteredRoles[index].id}
        role={filteredRoles[index]}
        index={index}
        totalCount={filteredRoles.length}
        onInsert={handleInsert}
        guildId={guildId}
      />
    ),
    [filteredRoles, handleInsert, guildId],
  );

  const renderUserItem = React.useCallback(
    (index: number) => (
      <UserItem
        key={membersData?.results[index].id}
        user={membersData?.results[index]!}
        index={index}
        totalCount={membersData?.results.length || 0}
        onInsert={handleInsert}
      />
    ),
    [membersData, handleInsert],
  );

  const renderChannelItem = React.useCallback(
    (index: number) => (
      <ChannelItem
        key={filteredChannels[index].id}
        channel={filteredChannels[index]}
        index={index}
        totalCount={filteredChannels.length}
        onInsert={handleInsert}
      />
    ),
    [filteredChannels, handleInsert],
  );

  const getTitle = () => {
    if (step === "type-select") return "Insert Mention";
    if (selectedType === "role") return "Insert Role Mention";
    if (selectedType === "user") return "Insert User Mention";
    if (selectedType === "channel") return "Insert Channel Mention";

    return "Insert Mention";
  };

  const isLoading =
    (selectedType === "role" && isFetchingRoles) ||
    (selectedType === "user" && isFetchingMembers) ||
    (selectedType === "channel" && isFetchingChannels);

  const error =
    (selectedType === "role" && rolesError) ||
    (selectedType === "user" && membersError) ||
    (selectedType === "channel" && channelsError);

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
      finalFocusEl={() => onCloseFocusRef?.current ?? null}
    >
      <DialogContent color="fg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader borderBottomWidth="1px" borderColor="border">
          <HStack gap={2}>
            {step === "entity-select" && (
              <IconButton aria-label="Back" variant="ghost" size="sm" onClick={handleBack}>
                <FaArrowLeft />
              </IconButton>
            )}
            <DialogTitle>{getTitle()}</DialogTitle>
          </HStack>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody p={0}>
          {step === "type-select" && (
            <Box p={6}>
              <Text fontSize="sm" color="fg.muted" mb={6} textAlign="center">
                What would you like to mention?
              </Text>
              <SimpleGrid columns={excludeChannels ? 2 : 3} gap={4}>
                <Button
                  ref={roleButtonRef}
                  h="80px"
                  variant="outline"
                  colorPalette="brand"
                  onClick={() => handleTypeSelect("role")}
                  fontSize="md"
                >
                  <FaAt />
                  Role
                </Button>
                <Button
                  ref={userButtonRef}
                  h="80px"
                  variant="outline"
                  colorPalette="brand"
                  onClick={() => handleTypeSelect("user")}
                  fontSize="md"
                >
                  <FaAt />
                  User
                </Button>
                {!excludeChannels && (
                  <Button
                    ref={channelButtonRef}
                    h="80px"
                    variant="outline"
                    colorPalette="brand"
                    onClick={() => handleTypeSelect("channel")}
                    fontSize="md"
                  >
                    <FaHashtag />
                    Channel
                  </Button>
                )}
              </SimpleGrid>
            </Box>
          )}
          {step === "entity-select" && (
            <>
              <Box p={4} borderBottomWidth="1px" borderColor="border">
                <InputGroup startElement={<FaMagnifyingGlass color="fg.muted" />} w="full">
                  <Input
                    ref={searchInputRef}
                    placeholder={
                      selectedType === "user"
                        ? "Type to search for users..."
                        : `Search ${selectedType}s...`
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </InputGroup>
                {selectedType === "role" && !isLoading && !error && (
                  <Text fontSize="xs" color="fg.muted" mt={2}>
                    {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""} available
                  </Text>
                )}
                {selectedType === "channel" && !isLoading && !error && (
                  <Text fontSize="xs" color="fg.muted" mt={2}>
                    {filteredChannels.length} channel{filteredChannels.length !== 1 ? "s" : ""}{" "}
                    available
                  </Text>
                )}
                {selectedType === "user" && !searchTerm && (
                  <Text fontSize="xs" color="fg.muted" mt={2}>
                    Type to search for server members
                  </Text>
                )}
                {selectedType === "user" && searchTerm && !isLoading && !error && membersData && (
                  <Text fontSize="xs" color="fg.muted" mt={2}>
                    {membersData.results.length} user{membersData.results.length !== 1 ? "s" : ""}{" "}
                    found
                  </Text>
                )}
              </Box>
              <Box>
                {isLoading && (
                  <Box p={6} textAlign="center" role="status" aria-live="polite">
                    <VStack gap={4}>
                      <Spinner color="text.link" size="lg" borderWidth="4px" aria-hidden="true" />
                      <Text color="fg.subtle" fontWeight="medium">
                        Loading...
                      </Text>
                    </VStack>
                  </Box>
                )}
                {!isLoading && error && (
                  <Box p={6} textAlign="center" role="alert" aria-live="assertive">
                    <VStack gap={4}>
                      <Text color="text.error" fontWeight="medium">
                        Failed to load
                      </Text>
                      <Text color="fg.muted" fontSize="sm">
                        Please try again later.
                      </Text>
                    </VStack>
                  </Box>
                )}
                {/* Roles list */}
                {selectedType === "role" && !isLoading && !error && filteredRoles.length === 0 && (
                  <Box p={6} textAlign="center" role="status">
                    <Text color="fg.muted" fontStyle="italic">
                      No roles found
                    </Text>
                  </Box>
                )}
                {selectedType === "role" && !isLoading && !error && filteredRoles.length > 0 && (
                  <Virtuoso
                    style={{ height: "50vh", width: "100%" }}
                    totalCount={filteredRoles.length}
                    itemContent={renderRoleItem}
                    tabIndex={0}
                    role="listbox"
                    aria-label="Available roles"
                  />
                )}
                {/* Users list */}
                {selectedType === "user" && !isLoading && !error && !searchTerm && (
                  <Box p={6} textAlign="center" role="status">
                    <Text color="fg.muted" fontStyle="italic">
                      Type to search for users
                    </Text>
                  </Box>
                )}
                {selectedType === "user" &&
                  !isLoading &&
                  !error &&
                  searchTerm &&
                  (!membersData || membersData.results.length === 0) && (
                    <Box p={6} textAlign="center" role="status" aria-live="polite">
                      <Text color="fg.muted" fontStyle="italic">
                        No users found
                      </Text>
                    </Box>
                  )}
                {selectedType === "user" &&
                  !isLoading &&
                  !error &&
                  searchTerm &&
                  membersData &&
                  membersData.results.length > 0 && (
                    <Virtuoso
                      style={{ height: "50vh", width: "100%" }}
                      totalCount={membersData.results.length}
                      itemContent={renderUserItem}
                      tabIndex={0}
                      role="listbox"
                      aria-label="Search results"
                    />
                  )}
                {/* Channels list */}
                {selectedType === "channel" &&
                  !isLoading &&
                  !error &&
                  filteredChannels.length === 0 && (
                    <Box p={6} textAlign="center" role="status">
                      <Text color="fg.muted" fontStyle="italic">
                        No channels found
                      </Text>
                    </Box>
                  )}
                {selectedType === "channel" &&
                  !isLoading &&
                  !error &&
                  filteredChannels.length > 0 && (
                    <Virtuoso
                      style={{ height: "50vh", width: "100%" }}
                      totalCount={filteredChannels.length}
                      itemContent={renderChannelItem}
                      tabIndex={0}
                      role="listbox"
                      aria-label="Available channels"
                    />
                  )}
              </Box>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};

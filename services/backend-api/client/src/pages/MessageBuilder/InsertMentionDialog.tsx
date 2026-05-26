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
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  HStack,
  Avatar,
  SimpleGrid,
  IconButton,
} from "@chakra-ui/react";
import { ArrowBackIcon, AtSignIcon, ChevronRightIcon, SearchIcon } from "@chakra-ui/icons";
import { FaHashtag, FaBullhorn, FaComments } from "react-icons/fa";
import { Virtuoso } from "react-virtuoso";
import {
  useDiscordServerRoles,
  useDiscordServerMembers,
  useDiscordServerChannels,
  GetDiscordChannelType,
} from "../../features/discordServers";
import { useDebounce } from "../../hooks";

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
      borderBottom={index < totalCount - 1 ? "1px solid" : undefined}
      borderColor="gray.600"
      _hover={{ bg: "gray.700" }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <HStack spacing={3}>
          <Box w={3} h={3} borderRadius="full" bg={role.color || "gray.500"} flexShrink={0} />
          <Text fontSize="sm" fontWeight="medium">
            {displayName}
          </Text>
        </HStack>
        <Button
          size="sm"
          colorScheme="blue"
          variant="outline"
          onClick={() => onInsert({ id: role.id, type: "role", text: mentionText })}
          flexShrink={0}
          rightIcon={<ChevronRightIcon />}
        >
          Insert
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
      borderBottom={index < totalCount - 1 ? "1px solid" : undefined}
      borderColor="gray.600"
      _hover={{ bg: "gray.700" }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <HStack spacing={3}>
          <Avatar size="sm" name={user.username} src={user.avatarUrl || undefined} />
          <VStack align="start" spacing={0}>
            <Text fontSize="sm" fontWeight="medium">
              @{user.displayName || user.username}
            </Text>
            {user.displayName && user.displayName !== user.username && (
              <Text fontSize="xs" color="gray.400">
                {user.username}
              </Text>
            )}
          </VStack>
        </HStack>
        <Button
          size="sm"
          colorScheme="blue"
          variant="outline"
          onClick={() => onInsert({ id: user.id, type: "user", text: `<@${user.id}>` })}
          flexShrink={0}
          rightIcon={<ChevronRightIcon />}
        >
          Insert
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
      return <Box as={FaBullhorn} color="gray.400" fontSize="sm" />;
    case "forum":
      return <Box as={FaComments} color="gray.400" fontSize="sm" />;
    case "text":
    default:
      return <Box as={FaHashtag} color="gray.400" fontSize="sm" />;
  }
};

const ChannelItem: React.FC<ChannelItemProps> = ({ channel, index, totalCount, onInsert }) => {
  return (
    <Box
      p={4}
      w="100%"
      borderRadius={0}
      borderBottom={index < totalCount - 1 ? "1px solid" : undefined}
      borderColor="gray.600"
      _hover={{ bg: "gray.700" }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <VStack align="start" spacing={0}>
          <HStack spacing={2}>
            {getChannelIcon(channel.type)}
            <Text fontSize="sm" fontWeight="medium">
              {channel.name}
            </Text>
          </HStack>
          {channel.category?.name && (
            <Text fontSize="xs" color="gray.400" ml={6}>
              {channel.category.name}
            </Text>
          )}
        </VStack>
        <Button
          size="sm"
          colorScheme="blue"
          variant="outline"
          onClick={() => onInsert({ id: channel.id, type: "channel", text: `<#${channel.id}>` })}
          flexShrink={0}
          rightIcon={<ChevronRightIcon />}
        >
          Insert
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
      r.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rolesData, searchTerm]);

  const filteredChannels = React.useMemo(() => {
    if (!channelsData?.results) return [];

    // Filter out categories and voice channels (not mentionable)
    const mentionableChannels = channelsData.results.filter(
      (c) => c.type !== "category" && c.type !== "voice"
    );

    if (!searchTerm) return mentionableChannels;

    return mentionableChannels.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
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
    [onSelected, onClose]
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
    [filteredRoles, handleInsert, guildId]
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
    [membersData, handleInsert]
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
    [filteredChannels, handleInsert]
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      finalFocusRef={onCloseFocusRef}
    >
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white" onClick={(e) => e.stopPropagation()}>
        <ModalHeader borderBottom="1px solid" borderColor="gray.600">
          <HStack spacing={2}>
            {step === "entity-select" && (
              <IconButton
                aria-label="Back"
                icon={<ArrowBackIcon />}
                variant="ghost"
                size="sm"
                onClick={handleBack}
              />
            )}
            <Text>{getTitle()}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={0}>
          {step === "type-select" && (
            <Box p={6}>
              <Text fontSize="sm" color="gray.400" mb={6} textAlign="center">
                What would you like to mention?
              </Text>
              <SimpleGrid columns={excludeChannels ? 2 : 3} spacing={4}>
                <Button
                  ref={roleButtonRef}
                  h="80px"
                  variant="outline"
                  colorScheme="blue"
                  onClick={() => handleTypeSelect("role")}
                  leftIcon={<AtSignIcon />}
                  fontSize="md"
                >
                  Role
                </Button>
                <Button
                  ref={userButtonRef}
                  h="80px"
                  variant="outline"
                  colorScheme="blue"
                  onClick={() => handleTypeSelect("user")}
                  leftIcon={<AtSignIcon />}
                  fontSize="md"
                >
                  User
                </Button>
                {!excludeChannels && (
                  <Button
                    ref={channelButtonRef}
                    h="80px"
                    variant="outline"
                    colorScheme="blue"
                    onClick={() => handleTypeSelect("channel")}
                    leftIcon={<Box as={FaHashtag} />}
                    fontSize="md"
                  >
                    Channel
                  </Button>
                )}
              </SimpleGrid>
            </Box>
          )}
          {step === "entity-select" && (
            <>
              <Box p={4} borderBottom="1px solid" borderColor="gray.600">
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="gray.400" />
                  </InputLeftElement>
                  <Input
                    ref={searchInputRef}
                    placeholder={
                      selectedType === "user"
                        ? "Type to search for users..."
                        : `Search ${selectedType}s...`
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    bg="gray.700"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </InputGroup>
                {selectedType === "role" && !isLoading && !error && (
                  <Text fontSize="xs" color="gray.400" mt={2}>
                    {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""} available
                  </Text>
                )}
                {selectedType === "channel" && !isLoading && !error && (
                  <Text fontSize="xs" color="gray.400" mt={2}>
                    {filteredChannels.length} channel{filteredChannels.length !== 1 ? "s" : ""}{" "}
                    available
                  </Text>
                )}
                {selectedType === "user" && !searchTerm && (
                  <Text fontSize="xs" color="gray.400" mt={2}>
                    Type to search for server members
                  </Text>
                )}
                {selectedType === "user" && searchTerm && !isLoading && !error && membersData && (
                  <Text fontSize="xs" color="gray.400" mt={2}>
                    {membersData.results.length} user{membersData.results.length !== 1 ? "s" : ""}{" "}
                    found
                  </Text>
                )}
              </Box>
              <Box>
                {isLoading && (
                  <Box p={6} textAlign="center" role="status" aria-live="polite">
                    <VStack spacing={4}>
                      <Spinner color="blue.400" size="lg" thickness="4px" aria-hidden="true" />
                      <Text color="gray.300" fontWeight="medium">
                        Loading...
                      </Text>
                    </VStack>
                  </Box>
                )}
                {!isLoading && error && (
                  <Box p={6} textAlign="center" role="alert" aria-live="assertive">
                    <VStack spacing={4}>
                      <Text color="red.400" fontWeight="medium">
                        Failed to load
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        Please try again later.
                      </Text>
                    </VStack>
                  </Box>
                )}
                {/* Roles list */}
                {selectedType === "role" && !isLoading && !error && filteredRoles.length === 0 && (
                  <Box p={6} textAlign="center" role="status">
                    <Text color="gray.400" fontStyle="italic">
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
                    <Text color="gray.400" fontStyle="italic">
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
                      <Text color="gray.400" fontStyle="italic">
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
                      <Text color="gray.400" fontStyle="italic">
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
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

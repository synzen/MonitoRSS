import React, { useRef, useState } from "react";
import {
  VStack,
  HStack,
  Text,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Switch,
  Stack,
  Code,
  Center,
  Spinner,
  Tag,
  Tooltip,
  Flex,
  Divider,
  Checkbox,
  Box,
  IconButton,
  Heading,
  Radio,
  RadioGroup,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
} from "@chakra-ui/react";
import { FiFilter } from "react-icons/fi";
import { Controller, useFormContext } from "react-hook-form";
import { InputWithInsertPlaceholder } from "../../../components/InputWithInsertPlaceholder";
import { HelpDialog } from "../../../components";
import MessagePlaceholderText from "../../../components/MessagePlaceholderText";
import { useDiscordChannelForumTags } from "../../../features/feedConnections/hooks";
import { DiscordForumTagFiltersDialog } from "../../../features/feedConnections/components/DiscordMessageForm/DiscordForumTagFiltersDialog";
import { LogicalFilterExpression } from "../../../features/feedConnections/types";
import { useUserFeedConnectionContext } from "../../../contexts/UserFeedConnectionContext";
import { FeedDiscordChannelConnection } from "../../../types";
import { useDiscordWebhook } from "../../../features/discordWebhooks";
import MessageBuilderFormState from "../types/MessageBuilderFormState";
import { useMessageBuilderContext } from "../MessageBuilderContext";
import { ComponentType } from "../types";
import { DiscordMessageMentionForm } from "../../../features/feedConnections/components/DiscordMessageForm/DiscordMessageMentionForm";
import { DiscordMessagePlaceholderLimitsForm } from "../../../features/feedConnections/components/DiscordMessageForm/DiscordMessagePlaceholderLimitsForm";

const TagCheckbox = ({
  emojiName,
  hasPermissionToUse,
  id,
  isChecked,
  filters,
  name,
  onChange,
}: {
  id: string;
  isChecked: boolean;
  filters: { expression: LogicalFilterExpression } | null;
  onChange: (e: boolean, filters: { expression: LogicalFilterExpression } | null) => void;
  emojiName: string | null;
  name?: string;
  hasPermissionToUse: boolean;
}) => {
  return (
    <Tooltip isDisabled={hasPermissionToUse} label="Missing permissions to use this tag">
      <Tag
        key={id}
        borderRadius="full"
        variant="solid"
        size="lg"
        paddingX="4"
        paddingY="2"
        bg="gray.700"
      >
        <HStack divider={<Divider orientation="vertical" height="5" />} spacing={2}>
          <Checkbox
            value={id}
            isDisabled={!isChecked && !hasPermissionToUse}
            isChecked={isChecked}
            onChange={(e) => {
              onChange(e.target.checked, filters);
            }}
          >
            <HStack>
              <Box aria-hidden>{emojiName}</Box>
              <Text>{name || "(no tag name)"}</Text>
            </HStack>
          </Checkbox>
          {isChecked && (
            <DiscordForumTagFiltersDialog
              tagName={`${emojiName || ""} ${name || ""}`.trim()}
              onFiltersUpdated={async (newFilters) => {
                onChange(isChecked, newFilters);
              }}
              filters={filters}
              trigger={
                <IconButton
                  icon={<FiFilter />}
                  aria-label="Tag filters"
                  size="xs"
                  borderRadius="full"
                  variant="ghost"
                  isDisabled={!hasPermissionToUse || !isChecked}
                />
              }
            />
          )}
        </HStack>
      </Tag>
    </Tooltip>
  );
};

export const LegacyRootProperties: React.FC = () => {
  const { updateCurrentlySelectedComponent: onChange, switchRootType } = useMessageBuilderContext();
  const { watch, control } = useFormContext<MessageBuilderFormState>();
  const component = watch("messageComponent");
  const isForumChannel = watch("messageComponent.isForumChannel");
  
  // Root type switching confirmation dialog
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pendingRootType, setPendingRootType] = useState<ComponentType.LegacyRoot | ComponentType.V2Root | null>(null);
  
  const handleRootTypeChange = (value: string) => {
    const targetType = value as ComponentType.LegacyRoot | ComponentType.V2Root;
    if (component?.type === targetType) return;
    
    // Check if there are children that would be lost
    if (component?.children && component.children.length > 0) {
      setPendingRootType(targetType);
      onOpen();
    } else {
      switchRootType(targetType);
    }
  };
  
  const confirmSwitch = () => {
    if (pendingRootType) {
      switchRootType(pendingRootType);
      setPendingRootType(null);
    }
    onClose();
  };

  // Get connection information for forum tags
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const guildId = connection?.details.channel?.guildId || connection?.details.webhook?.guildId;
  const channelId = connection?.details.channel?.id;
  const webhookId = connection?.details.webhook?.id;
  const { data: discordWebhookData } = useDiscordWebhook({
    webhookId,
  });
  const { status: forumTagsStatus, data: availableTags } = useDiscordChannelForumTags({
    channelId: webhookId ? discordWebhookData?.result.channelId : channelId,
    serverId: guildId,
  });
  const availableTagIds = new Set(availableTags?.map((tag) => tag.id));
  const deletedTagIds = new Set(
    connection?.details.forumThreadTags?.filter((v) => !availableTagIds.has(v.id)).map((v) => v.id)
  );
  const showChannelNewThreadOptions = connection.details.channel?.type === "new-thread";

  if (!component) {
    return null;
  }

  const isLegacyRoot = component?.type === ComponentType.LegacyRoot;

  return (
    <VStack align="stretch" spacing={6}>
      {/* Root Type Selector */}
      <FormControl>
        <FormLabel fontSize="sm" fontWeight="medium" color="gray.200">
          Message Format
        </FormLabel>
        <RadioGroup
          value={component?.type || ComponentType.LegacyRoot}
          onChange={handleRootTypeChange}
        >
          <Stack direction="row" spacing={4}>
            <Radio value={ComponentType.LegacyRoot}>Legacy Message</Radio>
            <Radio value={ComponentType.V2Root}>Components V2</Radio>
          </Stack>
        </RadioGroup>
        <FormHelperText fontSize="sm" color="gray.400">
          {isLegacyRoot
            ? "Legacy format supports text content, embeds, and buttons."
            : "Components V2 format supports text displays, sections, dividers, and action rows."}
        </FormHelperText>
      </FormControl>

      {/* Confirmation Dialog */}
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Switch Message Format</AlertDialogHeader>
            <AlertDialogBody>
              Switching message format will clear your current message content. Settings like thread
              title, mentions, and placeholder limits will be preserved. You can use the Discard
              Changes button to undo this action before saving.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmSwitch} ml={3}>
                Switch Format
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {isForumChannel && (
        <>
          <Heading as="h3" size="sm" mb={-2}>
            Forum Thread
          </Heading>
          <Controller
            name="messageComponent.forumThreadTitle"
            control={control}
            render={({ field: { value, onChange: fieldOnChange } }) => {
              return (
                <InputWithInsertPlaceholder
                  value={value || ""}
                  onChange={(v) => fieldOnChange(v)}
                  label="Forum Thread Title"
                  placeholder="Forum thread title"
                  as="input"
                  helperText={
                    <>
                      The title of the thread that will be created per new article. You may use
                      placeholders. The default is{" "}
                      <MessagePlaceholderText withoutCopy>title</MessagePlaceholderText>.
                    </>
                  }
                />
              );
            }}
          />
          <FormControl>
            <Text fontSize="sm" mb={2} color="gray.200">
              Forum Thread Tags
            </Text>
            {forumTagsStatus === "loading" && (
              <Center height="100%">
                <Spinner />
              </Center>
            )}
            {forumTagsStatus === "success" && !availableTags?.length && (
              <Text fontSize="sm" color="gray.400">
                No tags found in this channel.
              </Text>
            )}
            <FormHelperText fontSize="sm" color="gray.400" mb={2}>
              Select tags to apply to forum threads created for new articles. You may optionally
              define article filters to only attach certain tags for certain articles.
            </FormHelperText>
            {forumTagsStatus === "success" && availableTags && availableTags.length > 0 && (
              <Flex gap={4} flexWrap="wrap">
                {availableTags.map(({ id, name, hasPermissionToUse, emojiName }) => {
                  const filters =
                    (component.forumThreadTags?.find((v) => v.id === id)?.filters as {
                      expression: LogicalFilterExpression;
                    } | null) || null;

                  return (
                    <TagCheckbox
                      key={id}
                      filters={filters || null}
                      emojiName={emojiName}
                      hasPermissionToUse={hasPermissionToUse}
                      id={id}
                      name={name}
                      isChecked={!!component.forumThreadTags?.find((v) => v.id === id)}
                      onChange={(isChecked, newFilters) => {
                        const useNewFilters =
                          Object.keys(newFilters?.expression || {}).length > 0 ? newFilters : null;

                        const fieldsWithoutDeletedTags =
                          component.forumThreadTags?.filter((v) => !deletedTagIds.has(v.id)) || [];

                        if (!isChecked) {
                          const newVal = fieldsWithoutDeletedTags.filter((v) => v.id !== id);
                          onChange({ ...component, forumThreadTags: newVal });

                          return;
                        }

                        const existingFieldIndex = fieldsWithoutDeletedTags.findIndex(
                          (v) => v.id === id
                        );

                        if (existingFieldIndex === -1) {
                          const newVal = fieldsWithoutDeletedTags.concat([
                            { id, filters: useNewFilters },
                          ]);
                          onChange({ ...component, forumThreadTags: newVal });

                          return;
                        }

                        const newVal = [...fieldsWithoutDeletedTags];
                        newVal.splice(existingFieldIndex, 1, {
                          id,
                          filters: useNewFilters,
                        });

                        onChange({ ...component, forumThreadTags: newVal });
                      }}
                    />
                  );
                })}
              </Flex>
            )}
          </FormControl>
        </>
      )}
      {showChannelNewThreadOptions && (
        <>
          <Heading as="h3" size="sm" mb={-2}>
            Channel Thread
          </Heading>
          <Controller
            name="messageComponent.channelNewThreadTitle"
            control={control}
            render={({ field: { value, onChange: fieldOnChange } }) => {
              return (
                <InputWithInsertPlaceholder
                  value={value || ""}
                  onChange={(v) => fieldOnChange(v)}
                  label="Channel Thread Title"
                  placeholder="Channel thread title"
                  as="input"
                  helperText={
                    <>
                      The title of the thread that will be created per new article. You may use
                      placeholders. The default is{" "}
                      <MessagePlaceholderText withoutCopy withBrackets>
                        title
                      </MessagePlaceholderText>
                      .
                    </>
                  }
                />
              );
            }}
          />
          <FormControl>
            <HStack justify="space-between" align="center" mb={2}>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.200" mb={0}>
                Hide Message in Channel
              </FormLabel>
              <Controller
                name="messageComponent.channelNewThreadExcludesPreview"
                control={control}
                render={({ field: { value, onChange: fieldOnChange } }) => {
                  return (
                    <Switch
                      isChecked={!!value}
                      onChange={(e) => fieldOnChange(e.target.checked)}
                      colorScheme="blue"
                    />
                  );
                }}
              />
            </HStack>
            <FormHelperText fontSize="sm" color="gray.400">
              If enabled, the message contents will only be shown inside the thread. Only the thread
              title will be shown in the channel.
            </FormHelperText>
          </FormControl>
        </>
      )}
      {/* Text Content settings - shared between Legacy and V2 */}
      <>
        <Heading as="h3" size="sm" mb={-2}>
          Text Content
        </Heading>
          <FormControl>
            <HStack justify="space-between" align="center" mb={2}>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.200" mb={0}>
                Format Tables
              </FormLabel>
              <Controller
                name="messageComponent.formatTables"
                control={control}
                render={({ field: { value, onChange: fieldOnChange } }) => {
                  return (
                    <Switch
                      isChecked={!!value}
                      onChange={(e) => fieldOnChange(e.target.checked)}
                      colorScheme="blue"
                    />
                  );
                }}
              />
            </HStack>
            <FormHelperText fontSize="sm" color="gray.400">
              If enabled, tables will be formatted to ensure uniform spacing. This is done by wrapping
              the table with triple backticks (```table here``` for example).
            </FormHelperText>
          </FormControl>
          <FormControl>
            <HStack justify="space-between" align="center" mb={2}>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.200" mb={0}>
                Strip Images
              </FormLabel>
              <Controller
                name="messageComponent.stripImages"
                control={control}
                render={({ field: { value, onChange: fieldOnChange } }) => {
                  return (
                    <Switch
                      isChecked={!!value}
                      onChange={(e) => fieldOnChange(e.target.checked)}
                      colorScheme="blue"
                    />
                  );
                }}
              />
            </HStack>
            <FormHelperText fontSize="sm" color="gray.400">
              If enabled, all images with &quot;src&quot; attributes found in the message content will
              be removed.
            </FormHelperText>
          </FormControl>
          <FormControl>
            <HStack justify="space-between" align="center" mb={2}>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.200" mb={0}>
                Ignore New Lines
              </FormLabel>
              <Controller
                name="messageComponent.ignoreNewLines"
                control={control}
                render={({ field: { value, onChange: fieldOnChange } }) => {
                  return (
                    <Switch
                      isChecked={!!value}
                      onChange={(e) => fieldOnChange(e.target.checked)}
                      colorScheme="blue"
                    />
                  );
                }}
              />
            </HStack>
            <FormHelperText fontSize="sm" color="gray.400">
              Prevents excessive new lines from being added to the message if the text content within
              placeholder content have new lines.
            </FormHelperText>
          </FormControl>
          <FormControl>
            <HStack justify="space-between" align="center" mb={2}>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.200" mb={0}>
                Placeholder Fallback
              </FormLabel>
              <Controller
                name="messageComponent.enablePlaceholderFallback"
                control={control}
                render={({ field: { value, onChange: fieldOnChange } }) => {
                  return (
                    <Switch
                      isChecked={!!value}
                      onChange={(e) => fieldOnChange(e.target.checked)}
                      colorScheme="blue"
                    />
                  );
                }}
              />
            </HStack>
            <FormHelperText fontSize="sm" color="gray.400">
              <Stack>
                <Text>
                  Support falling back on alternate values within a placeholder if there is no
                  placeholder value for a given article.
                </Text>
                <HelpDialog
                  trigger={
                    <Button
                      display="inline"
                      fontSize="sm"
                      colorScheme="blue"
                      variant="link"
                      whiteSpace="initial"
                      textAlign="left"
                      mb={2}
                    >
                      Click here to see how to use placeholder fallbacks.
                    </Button>
                  }
                  title="Using Placeholder Fallbacks"
                  body={
                    <Stack spacing={6}>
                      <Text>
                        To use placeholder fallbacks, separate each placeholder with <Code>||</Code>{" "}
                        within the curly braces. For example, if you use{" "}
                        <Code>{"{{title||description}}"}</Code>, then the description will be used if
                        the title is not available.{" "}
                      </Text>
                      <Text>
                        If all placeholders have no content, then you may add text as the final fallback
                        like so: <Code>{"{{title||description||text::my final text}}"}</Code>. In this
                        case, <Code>my final text</Code> will appear in the final output if both title
                        and description do not exist.
                      </Text>
                    </Stack>
                  }
                />
              </Stack>
            </FormHelperText>
          </FormControl>
        </>

      {/* Shared options for both root types */}
      <Heading as="h3" size="sm" mb={-2}>
        Additional Settings
      </Heading>
      <FormControl>
        <FormLabel fontSize="sm" fontWeight="medium" color="gray.200">
          Mentions
        </FormLabel>
        <FormHelperText fontSize="sm" color="gray.400" mb={2}>
          Roles and users that will be mentioned when articles are delivered. Use the{" "}
          <MessagePlaceholderText withBrackets>discord::mentions</MessagePlaceholderText>{" "}
          placeholder in your message content to include these mentions.
        </FormHelperText>
        <DiscordMessageMentionForm
          smallButton
          excludeDescription
          guildId={guildId}
          path="messageComponent.mentions"
        />
      </FormControl>
      <FormControl>
        <FormLabel fontSize="sm" fontWeight="medium" color="gray.200">
          Placeholder Limits
        </FormLabel>
        <FormHelperText mb={2}>
          Apply character limits to placeholders to shorten messages.
        </FormHelperText>
        <DiscordMessagePlaceholderLimitsForm
          excludeDescription
          small
          path="messageComponent.placeholderLimits"
        />
      </FormControl>
    </VStack>
  );
};

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
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
  useRadioGroup,
  useRadio,
  UseRadioProps,
} from "@chakra-ui/react";
import { CheckIcon, InfoIcon } from "@chakra-ui/icons";
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

interface FormatRadioCardProps extends UseRadioProps {
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

const FormatRadioCard: React.FC<FormatRadioCardProps> = (props) => {
  const { title, description, badge, badgeColor = "green", ...radioProps } = props;
  const { getInputProps, getRadioProps, state } = useRadio(radioProps);

  return (
    <Box as="label" width="100%" cursor="pointer">
      <input {...getInputProps()} />
      <Box
        {...getRadioProps()}
        p={4}
        borderRadius="md"
        borderWidth="2px"
        borderColor={state.isChecked ? "blue.400" : "gray.600"}
        bg={state.isChecked ? "blue.900" : "gray.800"}
        _hover={{
          borderColor: state.isChecked ? "blue.400" : "gray.500",
          bg: state.isChecked ? "blue.900" : "gray.700",
        }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "blue.400",
          outlineOffset: "2px",
        }}
        transition="all 0.2s"
      >
        <HStack spacing={3} align="flex-start">
          <Box
            bg={state.isChecked ? "blue.400" : "transparent"}
            borderWidth="2px"
            borderColor={state.isChecked ? "blue.400" : "gray.500"}
            borderRadius="full"
            p={1}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
            width="22px"
            height="22px"
            mt={0.5}
          >
            {state.isChecked && <CheckIcon boxSize={2.5} color="white" />}
          </Box>
          <Box flex={1}>
            <HStack mb={2} spacing={2}>
              <Text fontWeight="bold" color="white" fontSize="md">
                {title}
              </Text>
              {badge && (
                <Tag size="sm" colorScheme={badgeColor} variant="solid">
                  {badge}
                </Tag>
              )}
            </HStack>
            <Text fontSize="sm" color="gray.300">
              {description}
            </Text>
          </Box>
        </HStack>
      </Box>
    </Box>
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
  const [pendingRootType, setPendingRootType] = useState<
    ComponentType.LegacyRoot | ComponentType.V2Root | null
  >(null);

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

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: "messageFormat",
    value: component?.type || ComponentType.LegacyRoot,
    onChange: handleRootTypeChange,
  });

  const rootProps = getRootProps();

  if (!component) {
    return null;
  }

  return (
    <VStack align="stretch" spacing={6}>
      {/* Root Type Selector */}
      <FormControl as="fieldset">
        <FormLabel as="legend" fontSize="sm" fontWeight="medium" color="gray.200" mb={1}>
          Message Format
        </FormLabel>
        <FormHelperText color="gray.400" mb={3} mt={0}>
          The message format affects the types of components available when customizing your
          message.
        </FormHelperText>
        <VStack spacing={3} align="stretch" {...rootProps}>
          <FormatRadioCard
            {...getRadioProps({ value: ComponentType.LegacyRoot })}
            title="Components V1"
            description="Simpler and text-focused. Allows text content to be split across multiple messages."
            badge="Classic"
            badgeColor="gray"
          />
          <FormatRadioCard
            {...getRadioProps({ value: ComponentType.V2Root })}
            title="Components V2"
            description="More focused on visuals with greater customization of message layout. Does not allow text content to be split across multiple messages."
            badge="New"
          />
        </VStack>
      </FormControl>
      {/* Confirmation Dialog */}
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800">
            <AlertDialogHeader color="white" fontSize="lg">
              Switch to{" "}
              {pendingRootType === ComponentType.V2Root ? "Components V2" : "Components V1"}?
            </AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="stretch" spacing={4}>
                <HStack bg="orange.900" p={3} borderRadius="md" spacing={3}>
                  <InfoIcon color="orange.300" />
                  <Text fontSize="sm" color="orange.100">
                    All your{" "}
                    {pendingRootType === ComponentType.V2Root ? "Components V1" : "Components V2"}{" "}
                    components will be removed because each format uses different component types.
                    Your{" "}
                    {pendingRootType === ComponentType.V2Root ? "Components V1" : "Components V2"}{" "}
                    properties will be kept.
                  </Text>
                </HStack>
                <Text fontSize="sm" color="gray.400">
                  You can use the Discard Changes button to undo this before saving.
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose} variant="ghost">
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={confirmSwitch} ml={3}>
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
            If enabled, all images with &quot;src&quot; attributes found in{" "}
            {component?.type === ComponentType.V2Root
              ? "Text Display components"
              : "the message content"}{" "}
            will be removed.
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
            Prevents excessive new lines from being added to{" "}
            {component?.type === ComponentType.V2Root ? "Text Display components" : "the message"}{" "}
            if the text content within placeholder content have new lines.
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
                      If all placeholders have no content, then you may add text as the final
                      fallback like so: <Code>{"{{title||description||text::my final text}}"}</Code>
                      . In this case, <Code>my final text</Code> will appear in the final output if
                      both title and description do not exist.
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

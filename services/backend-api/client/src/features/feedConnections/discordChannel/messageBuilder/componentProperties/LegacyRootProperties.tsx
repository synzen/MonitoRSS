import React, { useRef, useState } from "react";
import {
  VStack,
  HStack,
  Text,
  Button,
  Stack,
  Code,
  Center,
  Spinner,
  Flex,
  Separator,
  Box,
  IconButton,
  Heading,
  Icon,
  RadioCard,
} from "@chakra-ui/react";
import { FaCircleInfo } from "react-icons/fa6";
import { FiFilter } from "react-icons/fi";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { InputWithInsertPlaceholder } from "../components/InputWithInsertPlaceholder";
import { HelpDialog } from "@/components";
import MessagePlaceholderText from "../components/MessagePlaceholderText";
import { useDiscordChannelForumTags } from "../../connection/hooks";
import { DiscordForumTagFiltersDialog } from "../../connection/components/DiscordMessageForm/DiscordForumTagFiltersDialog";
import { LogicalFilterExpression } from "../../connection/types";
import { useUserFeedConnectionContext } from "@/features/feed";
import { FeedDiscordChannelConnection } from "@/types";
import { useDiscordWebhook } from "@/features/discordWebhooks";
import { useMessageBuilderContext } from "../MessageBuilderContext";
import { ComponentType } from "../types";
import { DiscordMessageMentionForm } from "../../connection/components/DiscordMessageForm/DiscordMessageMentionForm";
import { DiscordMessagePlaceholderLimitsForm } from "../../connection/components/DiscordMessageForm/DiscordMessagePlaceholderLimitsForm";
import { useMessageBuilderStateContext } from "../state";
import { Tooltip } from "@/components/ui/tooltip";
import { Tag } from "@/components/ui/tag";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Tooltip disabled={hasPermissionToUse} content="Missing permissions to use this tag">
      <Tag
        key={id}
        borderRadius="full"
        variant="solid"
        size="lg"
        paddingX="4"
        paddingY="2"
        bg="bg.emphasized"
      >
        <HStack separator={<Separator orientation="vertical" height="5" />} gap={2}>
          <Checkbox
            value={id}
            disabled={!isChecked && !hasPermissionToUse}
            checked={isChecked}
            onCheckedChange={(e) => {
              onChange(!!e.checked, filters);
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
                  aria-label="Tag filters"
                  size="xs"
                  borderRadius="full"
                  variant="ghost"
                  disabled={!hasPermissionToUse || !isChecked}
                >
                  <FiFilter />
                </IconButton>
              }
            />
          )}
        </HStack>
      </Tag>
    </Tooltip>
  );
};

interface FormatRadioCardProps {
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  value: string;
}

const FormatRadioCard: React.FC<FormatRadioCardProps> = (props) => {
  const { title, description, badge, badgeColor = "green", value } = props;

  return (
    <RadioCard.Item value={value} width="100%">
      <RadioCard.ItemHiddenInput />
      <RadioCard.ItemControl p={4} borderRadius="l3" borderWidth="2px">
        <RadioCard.ItemContent>
          <HStack gap={3} align="flex-start">
            <RadioCard.ItemIndicator />
            <Box flex={1}>
              <HStack mb={2} gap={2}>
                <Text fontWeight="bold" color="fg" fontSize="md">
                  {title}
                </Text>
                {badge && (
                  <Tag size="sm" colorPalette={badgeColor} variant="solid">
                    {badge}
                  </Tag>
                )}
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                {description}
              </Text>
            </Box>
          </HStack>
        </RadioCard.ItemContent>
      </RadioCard.ItemControl>
    </RadioCard.Item>
  );
};

export const LegacyRootProperties: React.FC = () => {
  const { updateCurrentlySelectedComponent: onChange, switchRootType } = useMessageBuilderContext();
  const { messageComponent: component, dispatch } = useMessageBuilderStateContext();
  const isForumChannel = component?.isForumChannel;

  // Root type switching confirmation dialog
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pendingRootType, setPendingRootType] = useState<
    ComponentType.LegacyRoot | ComponentType.V2Root | null
  >(null);

  const handleRootTypeChange = (details: { value: string | null }) => {
    if (!details.value) return;
    const targetType = details.value as ComponentType.LegacyRoot | ComponentType.V2Root;
    if (component?.type === targetType) return;

    // Check if there are children that would be lost
    if (component?.children && component.children.length > 0) {
      setPendingRootType(targetType);
      setOpen(true);
    } else {
      switchRootType(targetType);
    }
  };

  const confirmSwitch = () => {
    if (pendingRootType) {
      switchRootType(pendingRootType);
      setPendingRootType(null);
    }

    setOpen(false);
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
    connection?.details.forumThreadTags?.filter((v) => !availableTagIds.has(v.id)).map((v) => v.id),
  );
  const showChannelNewThreadOptions = connection.details.channel?.type === "new-thread";

  if (!component) {
    return null;
  }

  return (
    <VStack align="stretch" gap={6}>
      {/* Root Type Selector */}
      <Field label="Message Format">
        <Text fontSize="sm" color="fg.muted" mb={3}>
          The message format affects the types of components available when customizing your
          message.
        </Text>
        <RadioCard.Root
          name="messageFormat"
          value={component?.type || ComponentType.LegacyRoot}
          onValueChange={handleRootTypeChange}
          width="100%"
        >
          <VStack gap={3} align="stretch">
            <FormatRadioCard
              value={ComponentType.LegacyRoot}
              title="Components V1"
              description="Simpler and text-focused. Allows text content to be split across multiple messages."
              badge="Classic"
              badgeColor="gray"
            />
            <FormatRadioCard
              value={ComponentType.V2Root}
              title="Components V2"
              description="More focused on visuals with greater customization of message layout. Does not allow text content to be split across multiple messages."
              badge="New"
            />
          </VStack>
        </RadioCard.Root>
      </Field>
      {/* Confirmation Dialog */}
      <DialogRoot
        role="alertdialog"
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        initialFocusEl={() => cancelRef.current}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle color="fg" fontSize="lg">
              Switch to{" "}
              {pendingRootType === ComponentType.V2Root ? "Components V2" : "Components V1"}?
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack align="stretch" gap={4}>
              <HStack
                colorPalette="orange"
                bg="colorPalette.subtle"
                p={3}
                borderRadius="l3"
                gap={3}
              >
                <Icon as={FaCircleInfo} color="text.warning" />
                <Text fontSize="sm" color="fg">
                  All your{" "}
                  {pendingRootType === ComponentType.V2Root ? "Components V1" : "Components V2"}{" "}
                  components will be removed because each format uses different component types.
                  Your{" "}
                  {pendingRootType === ComponentType.V2Root ? "Components V1" : "Components V2"}{" "}
                  properties will be kept.
                </Text>
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                You can use the Discard Changes button to undo this before saving.
              </Text>
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button ref={cancelRef} onClick={() => setOpen(false)} variant="ghost">
              Cancel
            </Button>
            <PrimaryActionButton onClick={confirmSwitch} ml={3}>
              Switch Format
            </PrimaryActionButton>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
      {isForumChannel && (
        <>
          <Heading as="h3" size="sm" mb={-2}>
            Forum Thread
          </Heading>
          <InputWithInsertPlaceholder
            value={component.forumThreadTitle || ""}
            onChange={(v) =>
              dispatch({ type: "UPDATE_ROOT_FIELD", field: "forumThreadTitle", value: v })
            }
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
            guildId={guildId}
          />
          <Field>
            <Text fontSize="sm" mb={2} color="fg">
              Forum Thread Tags
            </Text>
            {forumTagsStatus === "loading" && (
              <Center height="100%">
                <Spinner />
              </Center>
            )}
            {forumTagsStatus === "success" && !availableTags?.length && (
              <Text fontSize="sm" color="fg.muted">
                No tags found in this channel.
              </Text>
            )}
            <Text fontSize="sm" color="fg.muted" mb={2}>
              Select tags to apply to forum threads created for new articles. You may optionally
              define article filters to only attach certain tags for certain articles.
            </Text>
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
                          (v) => v.id === id,
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
          </Field>
        </>
      )}
      {showChannelNewThreadOptions && (
        <>
          <Heading as="h3" size="sm" mb={-2}>
            Channel Thread
          </Heading>
          <InputWithInsertPlaceholder
            value={component.channelNewThreadTitle || ""}
            onChange={(v) =>
              dispatch({ type: "UPDATE_ROOT_FIELD", field: "channelNewThreadTitle", value: v })
            }
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
            guildId={guildId}
          />
          <Field>
            <HStack justify="space-between" align="center" mb={2}>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                Hide Message in Channel
              </Text>
              <Switch
                inputProps={{ "aria-label": "Hide Message in Channel" }}
                checked={!!component.channelNewThreadExcludesPreview}
                onCheckedChange={(e) =>
                  dispatch({
                    type: "UPDATE_ROOT_FIELD",
                    field: "channelNewThreadExcludesPreview",
                    value: e.checked,
                  })
                }
                colorPalette="brand"
              />
            </HStack>
            <Text fontSize="sm" color="fg.muted">
              If enabled, the message contents will only be shown inside the thread. Only the thread
              title will be shown in the channel.
            </Text>
          </Field>
        </>
      )}
      {/* Text Content settings - shared between Legacy and V2 */}
      <>
        <Heading as="h3" size="sm" mb={-2}>
          Text Content
        </Heading>
        <Field>
          <HStack justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              Format Tables
            </Text>
            <Switch
              inputProps={{ "aria-label": "Format Tables" }}
              checked={!!component.formatTables}
              onCheckedChange={(e) =>
                dispatch({
                  type: "UPDATE_ROOT_FIELD",
                  field: "formatTables",
                  value: e.checked,
                })
              }
              colorPalette="brand"
            />
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            If enabled, tables will be formatted to ensure uniform spacing. This is done by wrapping
            the table with triple backticks (```table here``` for example).
          </Text>
        </Field>
        <Field>
          <HStack justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              Strip Images
            </Text>
            <Switch
              inputProps={{ "aria-label": "Strip Images" }}
              checked={!!component.stripImages}
              onCheckedChange={(e) =>
                dispatch({
                  type: "UPDATE_ROOT_FIELD",
                  field: "stripImages",
                  value: e.checked,
                })
              }
              colorPalette="brand"
            />
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            If enabled, all images with &quot;src&quot; attributes found in{" "}
            {component?.type === ComponentType.V2Root
              ? "Text Display components"
              : "the message content"}{" "}
            will be removed.
          </Text>
        </Field>
        <Field>
          <HStack justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              Ignore New Lines
            </Text>
            <Switch
              inputProps={{ "aria-label": "Ignore New Lines" }}
              checked={!!component.ignoreNewLines}
              onCheckedChange={(e) =>
                dispatch({
                  type: "UPDATE_ROOT_FIELD",
                  field: "ignoreNewLines",
                  value: e.checked,
                })
              }
              colorPalette="brand"
            />
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            Prevents excessive new lines from being added to{" "}
            {component?.type === ComponentType.V2Root ? "Text Display components" : "the message"}{" "}
            if the text content within placeholder content have new lines.
          </Text>
        </Field>
        <Field>
          <HStack justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              Placeholder Fallback
            </Text>
            <Switch
              inputProps={{ "aria-label": "Placeholder Fallback" }}
              checked={!!component.enablePlaceholderFallback}
              onCheckedChange={(e) =>
                dispatch({
                  type: "UPDATE_ROOT_FIELD",
                  field: "enablePlaceholderFallback",
                  value: e.checked,
                })
              }
              colorPalette="brand"
            />
          </HStack>
          <Text fontSize="sm" color="fg.muted">
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
                    colorPalette="brand"
                    variant="plain"
                    whiteSpace="initial"
                    textAlign="left"
                    mb={2}
                  >
                    Click here to see how to use placeholder fallbacks.
                  </Button>
                }
                title="Using Placeholder Fallbacks"
                body={
                  <Stack gap={6}>
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
          </Text>
        </Field>
      </>

      {/* Shared options for both root types */}
      <Heading as="h3" size="sm" mb={-2}>
        Additional Settings
      </Heading>
      <Field label="Mentions">
        <Text fontSize="sm" color="fg.muted" mb={2}>
          Roles and users that will be mentioned when articles are delivered. Use the{" "}
          <MessagePlaceholderText withBrackets>discord::mentions</MessagePlaceholderText>{" "}
          placeholder in your message content to include these mentions.
        </Text>
        <DiscordMessageMentionForm
          smallButton
          excludeDescription
          guildId={guildId}
          value={component.mentions}
          onChange={(v) => onChange({ ...component, mentions: v })}
        />
      </Field>
      <Field label="Placeholder Limits">
        <Text fontSize="sm" color="fg.muted" mb={2}>
          Apply character limits to placeholders to shorten messages.
        </Text>
        <DiscordMessagePlaceholderLimitsForm
          excludeDescription
          small
          value={component.placeholderLimits ?? []}
          onChange={(v) => onChange({ ...component, placeholderLimits: v })}
        />
      </Field>
    </VStack>
  );
};

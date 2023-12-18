import {
  Button,
  Checkbox,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  chakra,
  Heading,
  Text,
  Badge,
  Divider,
  Box,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserFeed } from "../../../feed/hooks";
import { FeedConnectionType, FeedDiscordChannelConnection } from "../../../../types";
import { getPrettyConnectionName } from "../../../../utils/getPrettyConnectionName";
import { CopyableConnectionDiscordChannelSettings } from "../../constants";
import { useConnection, useCreateDiscordChannelConnectionCopySettings } from "../../hooks";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { getPrettyConnectionDetail } from "../../../../utils/getPrettyConnectionDetail";

enum CopyCategory {
  Message = "Message",
  Webhook = "Webhook",
}

const CopyableSettingDescriptions: Record<
  CopyableConnectionDiscordChannelSettings,
  {
    description: string;
    category?: CopyCategory;
    hint?: string;
  }
> = {
  [CopyableConnectionDiscordChannelSettings.Channel]: {
    description: "Channel",
    hint: "Only applicable if the target connection does not use a webhook",
  },
  [CopyableConnectionDiscordChannelSettings.Filters]: {
    description: "Filters",
  },
  [CopyableConnectionDiscordChannelSettings.Embeds]: {
    description: "Embeds",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.PlaceholderLimits]: {
    description: "Placeholder limits",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.Content]: {
    description: "Text content",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.SplitOptions]: {
    description: "Text content split options",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.ContentFormatTables]: {
    description: "Format tables in text content",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.ContentStripImages]: {
    description: "Strip images in text content",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.ContentDisableImageLinkPreviews]: {
    description: "Disable image link previews in text content",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.Components]: {
    description: "Buttons",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.MessageMentions]: {
    description: "Mentions",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.ForumThreadTitle]: {
    description: "Forum thread title",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.ForumThreadTags]: {
    description: "Forum thread tags",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.placeholderFallbackSetting]: {
    description: "Placeholder fallback setting",
    category: CopyCategory.Message,
  },
  [CopyableConnectionDiscordChannelSettings.WebhookName]: {
    description: "Name",
    category: CopyCategory.Webhook,
  },
  [CopyableConnectionDiscordChannelSettings.WebhookIconUrl]: {
    description: "Icon URL",
    category: CopyCategory.Webhook,
  },
  [CopyableConnectionDiscordChannelSettings.WebhookThread]: {
    description: "Thread",
    category: CopyCategory.Webhook,
  },
  [CopyableConnectionDiscordChannelSettings.DeliveryRateLimits]: {
    description: "Delivery rate limits",
  },
  [CopyableConnectionDiscordChannelSettings.CustomPlaceholders]: {
    description: "Custom placeholders",
  },
};

const FORUM_RELATED_SETTINGS = [
  CopyableConnectionDiscordChannelSettings.ForumThreadTags,
  CopyableConnectionDiscordChannelSettings.ForumThreadTitle,
];

interface Props {
  feedId?: string;
  connectionId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCloseRef?: React.MutableRefObject<HTMLButtonElement | null>;
}

export const CopyDiscordChannelConnectionSettingsDialog = ({
  feedId,
  connectionId,
  isOpen,
  onClose,
  onCloseRef,
}: Props) => {
  const { mutateAsync, status } = useCreateDiscordChannelConnectionCopySettings();
  const { connection: uncastedConnection } = useConnection({
    feedId,
    connectionId,
  });
  const connection = uncastedConnection as FeedDiscordChannelConnection;
  const connectionIsInForum =
    connection?.details.channel?.type === "forum" || connection?.details.webhook?.type === "forum";
  const { t } = useTranslation();
  const { feed } = useUserFeed({ feedId });
  const [checkedSettings, setCheckedSettings] = useState<
    CopyableConnectionDiscordChannelSettings[]
  >([]);
  const [checkedConnections, setCheckedConnections] = useState<string[]>([]);

  const onCheckSettingChange = (
    setting: CopyableConnectionDiscordChannelSettings,
    checked: boolean
  ) => {
    if (checked && !checkedSettings.includes(setting)) {
      setCheckedSettings([...checkedSettings, setting]);
    } else if (!checked && checkedSettings.includes(setting)) {
      setCheckedSettings(checkedSettings.filter((s) => s !== setting));
    }
  };

  const onCheckConnectionChange = (inputConnectionId: string, checked: boolean) => {
    if (checked && !checkedConnections.includes(inputConnectionId)) {
      setCheckedConnections([...checkedConnections, inputConnectionId]);
    } else if (!checked && checkedConnections.includes(inputConnectionId)) {
      setCheckedConnections(checkedConnections.filter((c) => c !== inputConnectionId));
    }
  };

  const onCheckCategoryChange = (category: CopyCategory, checked: boolean) => {
    const settingsInCategory = Object.entries(CopyableSettingDescriptions)
      .filter(([, { category: settingCategory }]) => settingCategory === category)
      .map(([setting]) => setting as CopyableConnectionDiscordChannelSettings);

    if (checked) {
      setCheckedSettings([...checkedSettings, ...settingsInCategory]);
    } else {
      setCheckedSettings(checkedSettings.filter((s) => !settingsInCategory.includes(s)));
    }
  };

  const onClickSelectAllConnections = () => {
    setCheckedConnections(feed?.connections.map((c) => c.id) || []);
  };

  const onClickSelectNoneConnections = () => {
    setCheckedConnections([]);
  };

  const onSubmit = async () => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details: {
          properties: checkedSettings,
          targetDiscordChannelConnectionIds: checkedConnections,
        },
      });
      onClose();
      notifySuccess(t("common.success.savedChanges"));
      setCheckedConnections([]);
      setCheckedSettings([]);
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const checkboxesByCategories = Object.values(CopyCategory).map((category) => {
    if (category === CopyCategory.Webhook && !connection?.details.webhook) {
      return null;
    }

    const allCategorySettings = Object.values(CopyableConnectionDiscordChannelSettings).filter(
      (setting) => {
        return CopyableSettingDescriptions[setting].category === category;
      }
    );

    const allCategorySettingsAreChecked = allCategorySettings.every((setting) => {
      const settingDescription = CopyableSettingDescriptions[setting];

      if (settingDescription.category !== category) {
        return true;
      }

      return checkedSettings.includes(setting);
    });

    const noCategorySettingsAreChecked = allCategorySettings.every((setting) => {
      const settingDescription = CopyableSettingDescriptions[setting];

      if (settingDescription.category !== category) {
        return true;
      }

      return !checkedSettings.includes(setting);
    });

    return (
      <Stack key={category}>
        <Checkbox
          isChecked={allCategorySettingsAreChecked}
          isIndeterminate={!allCategorySettingsAreChecked && !noCategorySettingsAreChecked}
          onChange={(e) => onCheckCategoryChange(category, e.target.checked)}
        >
          {category}
          <br />
          {category === CopyCategory.Webhook && (
            <chakra.span color="whiteAlpha.600" fontSize={14}>
              Only applicable if the target connection uses a webhook
            </chakra.span>
          )}
        </Checkbox>
        {Object.entries(CopyableSettingDescriptions).map(
          ([setting, { description, category: settingCategory }]) => {
            if (settingCategory !== category) {
              return null;
            }

            const isForumRelated = FORUM_RELATED_SETTINGS.includes(
              setting as CopyableConnectionDiscordChannelSettings
            );

            if (isForumRelated && !connectionIsInForum) {
              return null;
            }

            return (
              <Checkbox
                key={setting}
                pl={6}
                onChange={(e) =>
                  onCheckSettingChange(
                    setting as CopyableConnectionDiscordChannelSettings,
                    e.target.checked
                  )
                }
                isChecked={checkedSettings.includes(
                  setting as CopyableConnectionDiscordChannelSettings
                )}
              >
                {description}
              </Checkbox>
            );
          }
        )}
      </Stack>
    );
  });

  const otherSettings = Object.values(CopyableConnectionDiscordChannelSettings).filter(
    (setting) => {
      return !CopyableSettingDescriptions[setting].category;
    }
  );

  const connectionDetail = getPrettyConnectionDetail(connection as never);

  return (
    <Modal size="xl" isOpen={isOpen} onClose={onClose} finalFocusRef={onCloseRef}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Copy connection settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={6}>
            <Stack py={4} px={4} bg="blackAlpha.300" rounded="md">
              <Badge bg="none" p={0}>
                Source Connection
              </Badge>
              <Divider />
              <Box>
                <Text fontSize="sm" color="gray.500">
                  {getPrettyConnectionName(connection as never)}
                </Text>
                {connectionDetail ? <Box>{connectionDetail}</Box> : null}
                <chakra.span fontWeight={600}>{connection?.name}</chakra.span>
              </Box>
            </Stack>
            <Text>
              Mass-copy settings from the source connection to another. This will overwrite the
              settings of the target connections.
            </Text>
            <Stack spacing={2}>
              <Heading size="sm" as="h2">
                Settings to Copy
              </Heading>
              <Text>Settings to copy from the source connection.</Text>
              <Stack>
                {checkboxesByCategories}
                {otherSettings.map((setting) => {
                  const settingDescription = CopyableSettingDescriptions[setting];

                  if (
                    setting === CopyableConnectionDiscordChannelSettings.Channel &&
                    !connection.details.channel
                  ) {
                    return null;
                  }

                  return (
                    <Checkbox
                      onChange={(e) => onCheckSettingChange(setting, e.target.checked)}
                      isChecked={checkedSettings.includes(setting)}
                    >
                      {settingDescription.description}
                      <br />
                      {settingDescription.hint && (
                        <chakra.span color="whiteAlpha.600" fontSize={14}>
                          {settingDescription.hint}
                        </chakra.span>
                      )}
                    </Checkbox>
                  );
                })}
              </Stack>
            </Stack>
            <Stack spacing={2}>
              <Heading size="sm" as="h2">
                Target Connections
              </Heading>
              <Text>
                The connections that will have their settings overwritten with the selected settings
                from the source connection.
              </Text>
              <HStack>
                <Button size="sm" onClick={onClickSelectAllConnections}>
                  Select All
                </Button>
                <Button size="sm" onClick={onClickSelectNoneConnections}>
                  Select None
                </Button>
              </HStack>
              <Stack>
                {feed?.connections
                  .filter((c) => c.key === FeedConnectionType.DiscordChannel)
                  .map((c) => {
                    return (
                      <Box
                        bg="blackAlpha.300"
                        borderWidth="2px"
                        borderColor={checkedConnections.includes(c.id) ? "blue.400" : "transparent"}
                        rounded="md"
                      >
                        <Checkbox
                          px={4}
                          py={3}
                          onChange={(e) => onCheckConnectionChange(c.id, e.target.checked)}
                          isChecked={checkedConnections.includes(c.id)}
                          width="100%"
                        >
                          <chakra.span ml={4} display="inline-block">
                            <chakra.span color="gray.500" fontSize="sm">
                              {getPrettyConnectionName(c as never)}
                            </chakra.span>
                            {connectionDetail ? (
                              <chakra.span display="block">{connectionDetail}</chakra.span>
                            ) : (
                              <br />
                            )}
                            <chakra.span fontWeight={600}>{c.name}</chakra.span>
                          </chakra.span>
                        </Checkbox>
                      </Box>
                    );
                  })}
              </Stack>
            </Stack>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={onSubmit}
              isLoading={status === "loading"}
              isDisabled={
                checkedConnections.length === 0 ||
                checkedSettings.length === 0 ||
                status === "loading"
              }
            >
              Confirm
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

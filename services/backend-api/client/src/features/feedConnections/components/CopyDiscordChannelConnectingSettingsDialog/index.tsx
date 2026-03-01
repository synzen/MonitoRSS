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
  FormControl,
  FormErrorMessage,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { array, InferType, object, string } from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { useUserFeed } from "../../../feed/hooks";
import { FeedDiscordChannelConnection } from "../../../../types";
import { getPrettyConnectionName } from "../../../../utils/getPrettyConnectionName";
import { CopyableConnectionDiscordChannelSettings } from "../../constants";
import { useConnection, useCreateDiscordChannelConnectionCopySettings } from "../../hooks";
import { getPrettyConnectionDetail } from "../../../../utils/getPrettyConnectionDetail";
import { ConnectionsCheckboxList } from "../ConnectionsCheckboxList";
import { UserFeed } from "../../../feed/types";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

enum CopyCategory {
  Message = "Message Format",
  Branding = "Branding",
}

const CopyableSettingDescriptions: Record<
  CopyableConnectionDiscordChannelSettings,
  {
    description: string;
    category?: CopyCategory;
    hint?: string;
  }
> = {
  [CopyableConnectionDiscordChannelSettings.Filters]: {
    description: "Filters",
  },
  [CopyableConnectionDiscordChannelSettings.ComponentsV2]: {
    description: "Components",
    category: CopyCategory.Message,
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
    category: CopyCategory.Branding,
  },
  [CopyableConnectionDiscordChannelSettings.WebhookIconUrl]: {
    description: "Avatar URL",
    category: CopyCategory.Branding,
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

// Settings that are irrelevant when V2 components are used
const V2_INCOMPATIBLE_SETTINGS = [
  CopyableConnectionDiscordChannelSettings.Embeds,
  CopyableConnectionDiscordChannelSettings.Content,
  CopyableConnectionDiscordChannelSettings.SplitOptions,
  CopyableConnectionDiscordChannelSettings.Components, // legacy buttons
];

const formSchema = object().shape({
  properties: array()
    .of(string().required())
    .min(1, "At least one setting must be selected")
    .required(),
  targetDiscordChannelConnectionIds: array()
    .of(string().required())
    .min(1, "At least one target connection must be selected")
    .required(),
});

type FormData = InferType<typeof formSchema>;

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
  const {
    control,
    formState: { errors, isSubmitted, isSubmitting, isValid },
    handleSubmit,
    reset,
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: {
      properties: [],
      targetDiscordChannelConnectionIds: [],
    },
  });
  const [{ length: checkedConnectionsLength }] = watch(["targetDiscordChannelConnectionIds"]);
  const {
    mutateAsync,
    status,
    error,
    reset: resetMutation,
  } = useCreateDiscordChannelConnectionCopySettings();
  const { connection: uncastedConnection } = useConnection({
    feedId,
    connectionId,
  });
  const { createSuccessAlert } = usePageAlertContext();
  const connection = uncastedConnection as FeedDiscordChannelConnection;
  const connectionIsInForum =
    connection?.details.channel?.type === "forum" || connection?.details.webhook?.type === "forum";
  // Check if V2 components are configured on the source connection
  const hasComponentsV2 =
    connection?.details?.componentsV2 && connection.details.componentsV2.length > 0;
  const { t } = useTranslation();
  const { feed } = useUserFeed({ feedId });

  useEffect(() => {
    reset();
    resetMutation();
  }, [isOpen]);

  const calculateNewCheckedSettings = (
    currentSettings: FormData["properties"],
    setting: CopyableConnectionDiscordChannelSettings,
    checked: boolean,
  ) => {
    if (checked && !currentSettings.includes(setting)) {
      return [...currentSettings, setting];
    }

    if (!checked && currentSettings.includes(setting)) {
      return currentSettings.filter((s) => s !== setting);
    }

    return currentSettings;
  };

  const calculateNewCheckedSettingsFromCategory = (
    currentSettings: FormData["properties"],
    category: CopyCategory,
    checked: boolean,
  ) => {
    const settingsInCategory = Object.entries(CopyableSettingDescriptions)
      .filter(([, { category: settingCategory }]) => settingCategory === category)
      .map(([setting]) => setting as CopyableConnectionDiscordChannelSettings);

    if (checked) {
      return [...currentSettings, ...settingsInCategory];
    }

    return currentSettings.filter(
      (s) => !settingsInCategory.includes(s as CopyableConnectionDiscordChannelSettings),
    );
  };

  const onSubmit = async ({ properties, targetDiscordChannelConnectionIds }: FormData) => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details: {
          properties: properties as CopyableConnectionDiscordChannelSettings[],
          targetDiscordChannelConnectionIds,
        },
      });
      onClose();
      createSuccessAlert({
        title: `Successfully copied connection settings of ${connection.name} to ${targetDiscordChannelConnectionIds.length} other connections.`,
      });
      reset();
    } catch (err) {}
  };

  const checkboxesByCategories = Object.values(CopyCategory).map((category) => {
    if (category === CopyCategory.Branding && !connection?.details.webhook) {
      return null;
    }

    const allCategorySettings = Object.values(CopyableConnectionDiscordChannelSettings).filter(
      (setting) => {
        if (CopyableSettingDescriptions[setting].category !== category) {
          return false;
        }

        // Filter out forum-related settings if not in forum
        const isForumRelated = FORUM_RELATED_SETTINGS.includes(setting);

        if (isForumRelated && !connectionIsInForum) {
          return false;
        }

        // Filter out V2-incompatible settings when V2 components exist
        const isV2Incompatible = V2_INCOMPATIBLE_SETTINGS.includes(setting);

        if (isV2Incompatible && hasComponentsV2) {
          return false;
        }

        // Filter out ComponentsV2 if no V2 components exist
        if (setting === CopyableConnectionDiscordChannelSettings.ComponentsV2 && !hasComponentsV2) {
          return false;
        }

        return true;
      },
    );

    // If no settings are visible in this category, don't render it
    if (allCategorySettings.length === 0) {
      return null;
    }

    return (
      <Controller
        name="properties"
        control={control}
        render={({ field }) => {
          const allCategorySettingsAreChecked = allCategorySettings.every((setting) => {
            return field.value.includes(setting);
          });

          const noCategorySettingsAreChecked = allCategorySettings.every((setting) => {
            return !field.value.includes(setting);
          });

          return (
            <fieldset key={category}>
              <chakra.legend srOnly>{category}</chakra.legend>
              <Stack>
                <Checkbox
                  isChecked={allCategorySettingsAreChecked}
                  isIndeterminate={!allCategorySettingsAreChecked && !noCategorySettingsAreChecked}
                  onChange={(e) => {
                    const newSettings = calculateNewCheckedSettingsFromCategory(
                      field.value,
                      category,
                      e.target.checked,
                    );

                    field.onChange(newSettings);
                  }}
                  inputProps={{
                    "aria-controls": allCategorySettings.join(" "),
                    "aria-checked":
                      !allCategorySettings && !noCategorySettingsAreChecked
                        ? "mixed"
                        : allCategorySettingsAreChecked,
                  }}
                >
                  {category}
                  <br />
                </Checkbox>
                {Object.entries(CopyableSettingDescriptions).map(
                  ([setting, { description, category: settingCategory }]) => {
                    if (settingCategory !== category) {
                      return null;
                    }

                    const isForumRelated = FORUM_RELATED_SETTINGS.includes(
                      setting as CopyableConnectionDiscordChannelSettings,
                    );

                    if (isForumRelated && !connectionIsInForum) {
                      return null;
                    }

                    // Hide V2-incompatible settings when V2 components exist
                    const isV2Incompatible = V2_INCOMPATIBLE_SETTINGS.includes(
                      setting as CopyableConnectionDiscordChannelSettings,
                    );

                    if (isV2Incompatible && hasComponentsV2) {
                      return null;
                    }

                    // Hide ComponentsV2 option if no V2 components exist
                    if (
                      setting === CopyableConnectionDiscordChannelSettings.ComponentsV2 &&
                      !hasComponentsV2
                    ) {
                      return null;
                    }

                    return (
                      <Checkbox
                        key={setting}
                        id={setting}
                        pl={6}
                        onChange={(e) => {
                          const newSettings = calculateNewCheckedSettings(
                            field.value,
                            setting as CopyableConnectionDiscordChannelSettings,
                            e.target.checked,
                          );

                          field.onChange(newSettings);
                        }}
                        isChecked={field.value.includes(
                          setting as CopyableConnectionDiscordChannelSettings,
                        )}
                      >
                        {description}
                      </Checkbox>
                    );
                  },
                )}
              </Stack>
            </fieldset>
          );
        }}
      />
    );
  });

  const otherSettings = Object.values(CopyableConnectionDiscordChannelSettings).filter(
    (setting) => {
      return !CopyableSettingDescriptions[setting].category;
    },
  );

  const connectionDetail = getPrettyConnectionDetail(connection as never);
  const formErrorLength = Object.keys(errors).length;

  return (
    <Modal size="xl" isOpen={isOpen} onClose={onClose} finalFocusRef={onCloseRef}>
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Copy connection settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={6}>
              <Text>
                Mass-copy settings from the source connection to another. This will overwrite the
                settings of the target connections.
              </Text>
              <Stack py={4} px={4} bg="gray.800" rounded="md">
                <Badge bg="none" p={0}>
                  Source Connection
                </Badge>
                <Divider />
                <Box>
                  <Text fontSize="sm" color="gray.400">
                    {getPrettyConnectionName(connection as never)}
                  </Text>
                  {connectionDetail ? <Box>{connectionDetail}</Box> : null}
                  <chakra.span fontWeight={600}>{connection?.name}</chakra.span>
                </Box>
              </Stack>
              <fieldset>
                <FormControl isInvalid={!!errors.properties}>
                  <Stack spacing={2}>
                    <legend>
                      <Stack spacing={2}>
                        <Heading size="sm" as="h2">
                          Settings to Copy
                        </Heading>
                        <Text>Settings to copy from the source connection.</Text>
                      </Stack>
                    </legend>
                    <Stack>
                      {checkboxesByCategories}
                      <Controller
                        name="properties"
                        control={control}
                        render={({ field }) => {
                          return (
                            <>
                              {otherSettings.map((setting) => {
                                const settingDescription = CopyableSettingDescriptions[setting];

                                return (
                                  <Checkbox
                                    onChange={(e) => {
                                      const newSettings = calculateNewCheckedSettings(
                                        field.value,
                                        setting,
                                        e.target.checked,
                                      );
                                      field.onChange(newSettings);
                                    }}
                                    isChecked={field.value.includes(setting)}
                                    key={setting}
                                  >
                                    {settingDescription.description}
                                    <br />
                                    {settingDescription.hint && (
                                      <chakra.span color="whiteAlpha.700" fontSize={14}>
                                        {settingDescription.hint}
                                      </chakra.span>
                                    )}
                                  </Checkbox>
                                );
                              })}
                            </>
                          );
                        }}
                      />
                    </Stack>
                    <FormErrorMessage>{errors.properties?.message}</FormErrorMessage>
                  </Stack>
                </FormControl>
              </fieldset>
              <Controller
                name="targetDiscordChannelConnectionIds"
                control={control}
                render={({ field }) => (
                  <fieldset>
                    <FormControl isInvalid={!!errors.targetDiscordChannelConnectionIds}>
                      <Stack spacing={2}>
                        <legend>
                          <Heading size="sm" as="h2">
                            Target Connections
                          </Heading>
                          <Text>
                            The connections that will have their settings overwritten with the
                            selected settings from the source connection.
                          </Text>
                        </legend>
                        <HStack>
                          <Button
                            size="sm"
                            onClick={() => field.onChange(feed?.connections.map((c) => c.id))}
                          >
                            Select all connections as targets
                          </Button>
                          <Button size="sm" onClick={() => field.onChange([])}>
                            Clear {checkedConnectionsLength} target connection selections
                          </Button>
                        </HStack>
                        <Stack>
                          <ConnectionsCheckboxList
                            checkedConnectionIds={field.value}
                            onCheckConnectionChange={field.onChange}
                            feed={feed as UserFeed}
                          />
                        </Stack>
                      </Stack>
                      <FormErrorMessage>
                        {errors.targetDiscordChannelConnectionIds?.message}
                      </FormErrorMessage>
                    </FormControl>
                  </fieldset>
                )}
              />
              {error && (
                <Box mt={4}>
                  <InlineErrorAlert
                    title={t("common.errors.somethingWentWrong")}
                    description={error.message}
                  />
                </Box>
              )}
            </Stack>
            {isSubmitted && formErrorLength > 0 && (
              <Box mt={4}>
                <InlineErrorIncompleteFormAlert fieldCount={formErrorLength} />
              </Box>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                <span>Cancel</span>
              </Button>
              <Button
                colorScheme="blue"
                mr={3}
                type="submit"
                isLoading={status === "loading"}
                aria-disabled={isSubmitting || !isValid}
              >
                <span>
                  Copy to{" "}
                  {checkedConnectionsLength === 1
                    ? "1 connection"
                    : `${checkedConnectionsLength} connections`}
                </span>
              </Button>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

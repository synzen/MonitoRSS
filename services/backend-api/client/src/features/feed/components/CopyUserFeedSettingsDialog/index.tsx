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
  Text,
  Badge,
  Divider,
  Box,
  FormControl,
  FormErrorMessage,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { array, InferType, mixed, object, string } from "yup";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect } from "react";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";
import { useCreateUserFeedCopySettings } from "../../hooks/useCreateUserFeedCopySettings";
import { CopyableUserFeedSettings } from "../../constants/copyableUserFeedSettings";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import { SelectableUserFeedList } from "./SelectableUserFeedList";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

enum CopyCategory {
  Comparisons = "Comparisons",
  MiscSettings = "Misc Settings",
}

const CopyableSettingDescriptions: Record<
  CopyableUserFeedSettings,
  {
    description: string;
    category?: CopyCategory;
    hint?: string;
  }
> = {
  [CopyableUserFeedSettings.Connections]: {
    description: "Connections",
  },
  [CopyableUserFeedSettings.PassingComparisons]: {
    description: "Passing Comparisons",
    category: CopyCategory.Comparisons,
  },
  [CopyableUserFeedSettings.BlockingComparisons]: {
    description: "Blocking Comparisons",
    category: CopyCategory.Comparisons,
  },
  [CopyableUserFeedSettings.ExternalProperties]: {
    description: "External Properties",
  },
  [CopyableUserFeedSettings.DateChecks]: {
    description: "Date Checks",
    category: CopyCategory.MiscSettings,
  },
  [CopyableUserFeedSettings.DatePlaceholderSettings]: {
    description: "Date Placeholder Settings",
    category: CopyCategory.MiscSettings,
  },
  [CopyableUserFeedSettings.RefreshRate]: {
    description: "Refresh Rate",
    category: CopyCategory.MiscSettings,
  },
};

const formSchema = object({
  checkedSettings: array()
    .of(
      mixed()
        .oneOf<CopyableUserFeedSettings>(
          Object.values(CopyableUserFeedSettings) as CopyableUserFeedSettings[]
        )
        .required()
    )
    .min(1, "At least one setting must be selected")
    .required(),
  checkedUserFeeds: array()
    .of(string().required())
    .min(1, "At least one feed must be selected")
    .required(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCloseRef?: React.MutableRefObject<HTMLButtonElement | null>;
}

export const CopyUserFeedSettingsDialog = ({ isOpen, onClose, onCloseRef }: Props) => {
  const { mutateAsync, status, error, reset: resetMutation } = useCreateUserFeedCopySettings();
  const { t } = useTranslation();
  const { userFeed: feed } = useUserFeedContext();
  const {
    control,
    formState: { errors, isSubmitted, isSubmitting, isValid },
    handleSubmit,
    reset,
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: {
      checkedSettings: [],
      checkedUserFeeds: [],
    },
  });
  const { createSuccessAlert } = usePageAlertContext();
  const [{ length: checkedUserFeedsLength }] = watch(["checkedUserFeeds"]);

  useEffect(() => {
    reset();
    resetMutation();
  }, [isOpen]);

  const calculateNewCheckedSettings = (
    currentSettings: FormData["checkedSettings"],
    setting: CopyableUserFeedSettings,
    checked: boolean
  ) => {
    if (checked && !currentSettings.includes(setting)) {
      return [...currentSettings, setting];
    }

    if (!checked && currentSettings.includes(setting)) {
      return currentSettings.filter((s) => s !== setting);
    }

    return currentSettings;
  };

  const calculateNewCheckedSettingsForCategory = (
    currentSettings: FormData["checkedSettings"],
    category: CopyCategory,
    checked: boolean
  ) => {
    const settingsInCategory = Object.entries(CopyableSettingDescriptions)
      .filter(([, { category: settingCategory }]) => settingCategory === category)
      .map(([setting]) => setting as CopyableUserFeedSettings);

    if (checked) {
      return [...currentSettings, ...settingsInCategory];
    }

    return currentSettings.filter(
      (s) => !settingsInCategory.includes(s as CopyableUserFeedSettings)
    );
  };

  const onSubmit = async ({ checkedSettings, checkedUserFeeds }: FormData) => {
    try {
      if (checkedSettings.length === 0 || status === "loading") {
        return;
      }

      await mutateAsync({
        feedId: feed.id,
        data: {
          settings: checkedSettings as CopyableUserFeedSettings[],
          targetFeedIds: checkedUserFeeds,
        },
      });
      onClose();
      createSuccessAlert({
        title: `Successfully copied feed settings ${checkedUserFeeds.length} other feeds`,
      });
      reset();
    } catch (err) {}
  };

  const formErrorCount = Object.keys(errors).length;

  const checkboxesByCategories = Object.values(CopyCategory).map((category) => {
    const allCategorySettings = Object.values(CopyableUserFeedSettings).filter((setting) => {
      return CopyableSettingDescriptions[setting].category === category;
    });

    return (
      <Controller
        name="checkedSettings"
        control={control}
        render={({ field }) => {
          const allCategorySettingsAreChecked = allCategorySettings.every((setting) => {
            const settingDescription = CopyableSettingDescriptions[setting];

            if (settingDescription.category !== category) {
              return true;
            }

            return field.value.includes(setting);
          });

          const noCategorySettingsAreChecked = allCategorySettings.every((setting) => {
            const settingDescription = CopyableSettingDescriptions[setting];

            if (settingDescription.category !== category) {
              return true;
            }

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
                    const newSettings = calculateNewCheckedSettingsForCategory(
                      field.value,
                      category,
                      e.target.checked
                    );

                    field.onChange(newSettings);
                  }}
                  inputProps={{
                    "aria-checked":
                      !allCategorySettingsAreChecked && !noCategorySettingsAreChecked
                        ? "mixed"
                        : allCategorySettingsAreChecked,
                    "aria-controls": allCategorySettings.join(" "),
                  }}
                >
                  {category}
                </Checkbox>
                <chakra.ul listStyleType="none" display="flex" flexDirection="column" gap={2}>
                  {Object.entries(CopyableSettingDescriptions).map(
                    ([setting, { description, category: settingCategory }]) => {
                      if (settingCategory !== category) {
                        return null;
                      }

                      return (
                        <chakra.li pl={6} key={setting}>
                          <Checkbox
                            id={setting}
                            onChange={(e) => {
                              const newSettings = calculateNewCheckedSettings(
                                field.value,
                                setting as CopyableUserFeedSettings,
                                e.target.checked
                              );

                              field.onChange(newSettings);
                            }}
                            isChecked={field.value.includes(setting as CopyableUserFeedSettings)}
                          >
                            {description}
                          </Checkbox>
                        </chakra.li>
                      );
                    }
                  )}
                </chakra.ul>
              </Stack>
            </fieldset>
          );
        }}
      />
    );
  });

  const otherSettings = Object.values(CopyableUserFeedSettings).filter((setting) => {
    return !CopyableSettingDescriptions[setting].category;
  });

  return (
    <Modal size="xl" isOpen={isOpen} onClose={onClose} finalFocusRef={onCloseRef}>
      <ModalOverlay />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <ModalHeader>Copy feed settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={6}>
              <Text>
                Copy settings from the source feed to another. This will overwrite the settings of
                the target feeds.
              </Text>
              <Stack py={4} px={4} bg="gray.800" rounded="md">
                <Badge bg="none" p={0}>
                  Source Feed
                </Badge>
                <Divider />
                <Box>
                  <Text>{feed.title}</Text>
                  <Text fontSize="sm" color="whiteAlpha.700" wordBreak="break-all">
                    {feed.url}
                  </Text>
                </Box>
              </Stack>
              <fieldset>
                <Controller
                  name="checkedSettings"
                  control={control}
                  render={({ field }) => (
                    <FormControl isInvalid={!!errors.checkedSettings}>
                      <Stack spacing={2}>
                        <legend>
                          <Text size="sm" fontWeight="semibold">
                            Settings to Copy
                          </Text>
                        </legend>
                        <Stack>
                          {otherSettings.map((setting) => {
                            const settingDescription = CopyableSettingDescriptions[setting];

                            return (
                              <Checkbox
                                onChange={(e) => {
                                  const newSettings = calculateNewCheckedSettings(
                                    field.value,
                                    setting,
                                    e.target.checked
                                  );
                                  field.onChange(newSettings);
                                }}
                                isChecked={field.value.includes(setting)}
                                key={setting}
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
                          {checkboxesByCategories}
                        </Stack>
                      </Stack>
                      <FormErrorMessage>{errors.checkedSettings?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
              </fieldset>
              <fieldset>
                <Controller
                  name="checkedUserFeeds"
                  control={control}
                  render={({ field }) => (
                    <FormControl isInvalid={!!errors.checkedUserFeeds}>
                      <Stack spacing={2}>
                        <legend>
                          <Stack spacing={2}>
                            <Text fontWeight="semibold" size="sm">
                              Target Feeds
                            </Text>
                            <Text>
                              The feeds that will have their settings overwritten with the selected
                              settings from the source feed.
                            </Text>
                          </Stack>
                        </legend>
                        <Box>
                          <Button size="sm" onClick={() => field.onChange([])}>
                            Clear {checkedUserFeedsLength} target feed selections
                          </Button>
                        </Box>
                        <Stack mt={1}>
                          <SelectableUserFeedList
                            onSelectedIdsChange={field.onChange}
                            selectedIds={field.value}
                          />
                        </Stack>
                        <FormErrorMessage>{errors.checkedUserFeeds?.message}</FormErrorMessage>
                      </Stack>
                    </FormControl>
                  )}
                />
              </fieldset>
            </Stack>
            {error && (
              <Box mt={4}>
                <InlineErrorAlert
                  title={t("common.errors.somethingWentWrong")}
                  description={error.message}
                />
              </Box>
            )}
            {isSubmitted && formErrorCount > 0 && (
              <Box mt={4}>
                <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
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
                  {checkedUserFeedsLength === 1 ? "1 feed" : `${checkedUserFeedsLength} feeds`}
                </span>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </form>
    </Modal>
  );
};

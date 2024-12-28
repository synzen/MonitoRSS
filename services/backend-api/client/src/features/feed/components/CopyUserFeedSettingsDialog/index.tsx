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
import { notifySuccess } from "../../../../utils/notifySuccess";
import { InlineErrorAlert } from "../../../../components";
import { useCreateUserFeedCopySettings } from "../../hooks/useCreateUserFeedCopySettings";
import { CopyableUserFeedSettings } from "../../constants/copyableUserFeedSettings";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import { SelectableUserFeedList } from "./SelectableUserFeedList";

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCloseRef?: React.MutableRefObject<HTMLButtonElement | null>;
}

export const CopyUserFeedSettingsDialog = ({ isOpen, onClose, onCloseRef }: Props) => {
  const { mutateAsync, status, error } = useCreateUserFeedCopySettings();
  const { t } = useTranslation();
  const { userFeed: feed } = useUserFeedContext();
  const [checkedSettings, setCheckedSettings] = useState<CopyableUserFeedSettings[]>([]);
  const [checkedUserFeeds, setCheckedUserFeeds] = useState<string[]>([]);

  const onCheckSettingChange = (setting: CopyableUserFeedSettings, checked: boolean) => {
    if (checked && !checkedSettings.includes(setting)) {
      setCheckedSettings([...checkedSettings, setting]);
    } else if (!checked && checkedSettings.includes(setting)) {
      setCheckedSettings(checkedSettings.filter((s) => s !== setting));
    }
  };

  const onCheckCategoryChange = (category: CopyCategory, checked: boolean) => {
    const settingsInCategory = Object.entries(CopyableSettingDescriptions)
      .filter(([, { category: settingCategory }]) => settingCategory === category)
      .map(([setting]) => setting as CopyableUserFeedSettings);

    if (checked) {
      setCheckedSettings([...checkedSettings, ...settingsInCategory]);
    } else {
      setCheckedSettings(checkedSettings.filter((s) => !settingsInCategory.includes(s)));
    }
  };

  const onClickSelectNoneConnections = () => {
    setCheckedUserFeeds([]);
  };

  const onSubmit = async () => {
    try {
      await mutateAsync({
        feedId: feed.id,
        data: {
          settings: checkedSettings,
          targetFeedIds: checkedUserFeeds,
        },
      });
      onClose();
      notifySuccess(t("common.success.savedChanges"));
      setCheckedUserFeeds([]);
      setCheckedSettings([]);
    } catch (err) {}
  };

  const checkboxesByCategories = Object.values(CopyCategory).map((category) => {
    const allCategorySettings = Object.values(CopyableUserFeedSettings).filter((setting) => {
      return CopyableSettingDescriptions[setting].category === category;
    });

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
        </Checkbox>
        {Object.entries(CopyableSettingDescriptions).map(
          ([setting, { description, category: settingCategory }]) => {
            if (settingCategory !== category) {
              return null;
            }

            return (
              <Checkbox
                key={setting}
                pl={6}
                onChange={(e) =>
                  onCheckSettingChange(setting as CopyableUserFeedSettings, e.target.checked)
                }
                isChecked={checkedSettings.includes(setting as CopyableUserFeedSettings)}
              >
                {description}
              </Checkbox>
            );
          }
        )}
      </Stack>
    );
  });

  const otherSettings = Object.values(CopyableUserFeedSettings).filter((setting) => {
    return !CopyableSettingDescriptions[setting].category;
  });

  return (
    <Modal size="xl" isOpen={isOpen} onClose={onClose} finalFocusRef={onCloseRef}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Copy feed settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={6}>
            <Text>
              Mass-copy settings from the source feed to another. This will overwrite the settings
              of the target feeds.
            </Text>
            <Stack py={4} px={4} bg="blackAlpha.300" rounded="md">
              <Badge bg="none" p={0}>
                Source Feed
              </Badge>
              <Divider />
              <Box>
                <Text>{feed.title}</Text>
                <Text fontSize="sm" color="whiteAlpha.600" wordBreak="break-all">
                  {feed.url}
                </Text>
              </Box>
            </Stack>
            <Stack spacing={2}>
              <Heading size="sm" as="h2">
                Settings to Copy
              </Heading>
              <Stack>
                {otherSettings.map((setting) => {
                  const settingDescription = CopyableSettingDescriptions[setting];

                  return (
                    <Checkbox
                      onChange={(e) => onCheckSettingChange(setting, e.target.checked)}
                      isChecked={checkedSettings.includes(setting)}
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
            <Stack spacing={2}>
              <Heading size="sm" as="h2">
                Target Feeds
              </Heading>
              <Text>
                The feeds that will have their settings overwritten with the selected settings from
                the source feed.
              </Text>
              <Box>
                <Button size="sm" onClick={onClickSelectNoneConnections}>
                  Select none
                </Button>
              </Box>
              <Stack mt={1}>
                <SelectableUserFeedList
                  onSelectedIdsChange={setCheckedUserFeeds}
                  selectedIds={checkedUserFeeds}
                />
                <Text>
                  Selected {checkedUserFeeds.length}{" "}
                  {checkedUserFeeds.length === 1 ? "feed" : "feeds"}
                </Text>
              </Stack>
            </Stack>
            {error && (
              <InlineErrorAlert
                title={t("common.errors.somethingWentWrong")}
                description={error.message}
              />
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              <span>Cancel</span>
            </Button>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={onSubmit}
              isLoading={status === "loading"}
              isDisabled={
                // checkedConnections.length === 0 ||
                checkedSettings.length === 0 || status === "loading"
              }
            >
              <span>Confirm</span>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

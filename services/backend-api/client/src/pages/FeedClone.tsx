import { Box, Button, Checkbox, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardContent, ThemedSelect } from "@/components";
import RouteParams from "../types/RouteParams";
import {
  FeedCloneProperties,
  useCloneFeed,
  useFeed,
  useFeeds,
  useFeedSubscribers,
} from "@/features/feed";
import { notifyError } from "@/utils/notifyError";
import { notifySuccess } from "@/utils/notifySuccess";

const FeedClone: React.FC = () => {
  const { feedId, serverId } = useParams<RouteParams>();
  const [properties, setProperties] = useState<FeedCloneProperties[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  const { mutateAsync } = useCloneFeed();
  const { setSearch, data, status } = useFeeds({
    serverId,
  });
  const {
    feed,
    status: feedStatus,
    error: feedError,
  } = useFeed({
    feedId,
  });
  const { refetch: refetchFeedSubscribers } = useFeedSubscribers({
    feedId,
  });
  const loadingFeeds = status === "loading";

  const onInputChange = (newVal: string) => {
    setSearch(newVal);
  };

  const onCheckboxChange = (key: FeedCloneProperties, checked: boolean) => {
    if (checked) {
      setProperties([...properties, key]);
    } else {
      setProperties(properties.filter((prop) => prop !== key));
    }
  };

  const onFeedSelected = (selectedId: string) => {
    setSelectedFeedId(selectedId);
  };

  const onSubmit = async () => {
    if (!feedId) {
      return;
    }

    try {
      setSaving(true);
      await mutateAsync({
        feedId,
        details: {
          properties,
          targetFeedIds: [selectedFeedId],
        },
      });

      if (properties.includes(FeedCloneProperties.SUBSCRIBERS)) {
        await refetchFeedSubscribers();
      }

      notifySuccess(t("pages.cloneFeed.success"));
      setSelectedFeedId("");
      setProperties([]);
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    } finally {
      setSaving(false);
    }
  };

  const checkboxOptions: Array<{ label: string; key: FeedCloneProperties }> = [
    {
      label: t("pages.cloneFeed.checkboxMessageLabel"),
      key: FeedCloneProperties.MESSAGE,
    },
    {
      label: t("pages.cloneFeed.checkboxFiltersLabel"),
      key: FeedCloneProperties.FITLERS,
    },
    {
      label: t("pages.cloneFeed.checkboxSubscribersLabel"),
      key: FeedCloneProperties.SUBSCRIBERS,
    },
    {
      label: t("pages.cloneFeed.checkboxMiscOptionsLabel"),
      key: FeedCloneProperties.MISC_OPTIONS,
    },
    {
      label: t("pages.cloneFeed.checkboxComparisonsLabel"),
      key: FeedCloneProperties.COMPARISONS,
    },
    {
      label: t("pages.cloneFeed.checkboxWebhookLabel"),
      key: FeedCloneProperties.WEBHOOK,
    },
  ];

  const feedsForDropdown =
    data?.results
      .filter((f) => f.id !== feedId)
      .map((f) => ({
        label: f.title,
        value: f.id,
        data: {},
      })) || [];

  return (
    <DashboardContent loading={feedStatus === "loading"} error={feedError}>
      <Stack spacing={12}>
        <Stack>
          <Heading size="lg">{t("pages.cloneFeed.title")}</Heading>
          <Text>{t("pages.cloneFeed.description")}</Text>
        </Stack>
        <Stack spacing={16}>
          <Stack spacing={3}>
            <Heading size="md">{t("pages.cloneFeed.propertiesSectionTitle")}</Heading>
            {checkboxOptions.map((option) => (
              <Checkbox
                onChange={(e) => onCheckboxChange(option.key, e.target.checked)}
                checked={properties.includes(option.key)}
                isChecked={properties.includes(option.key)}
              >
                {option.label}
              </Checkbox>
            ))}
          </Stack>
          <Stack spacing={3}>
            <Stack>
              <Heading size="md">{t("pages.cloneFeed.sourceFeedSectionTitle")}</Heading>
              <Text>{t("pages.cloneFeed.sourceFeedSectionDescription")}</Text>
            </Stack>
            <Box>
              <Text color="gray.500">{t("pages.cloneFeed.sourceFeedTitleLabel")}</Text>
              <Text>{feed?.title}</Text>
            </Box>
            <Box>
              <Text color="gray.500">{t("pages.cloneFeed.sourceFeedUrlLabel")}</Text>
              <Text>{feed?.url}</Text>
            </Box>
          </Stack>
          <Stack spacing={3}>
            <Heading size="md">{t("pages.cloneFeed.targetFeedSectionTitle")}</Heading>
            <ThemedSelect
              onChange={onFeedSelected}
              loading={loadingFeeds}
              onInputChange={onInputChange}
              value={selectedFeedId}
              options={feedsForDropdown}
            />
          </Stack>
        </Stack>
        <HStack justifyContent="flex-end">
          <Button
            onClick={onSubmit}
            isLoading={saving}
            isDisabled={!selectedFeedId || !properties.length || loadingFeeds || saving}
            colorScheme="blue"
          >
            <span>{t("pages.cloneFeed.cloneButtonLabel")}</span>
          </Button>
        </HStack>
      </Stack>
    </DashboardContent>
  );
};

export default FeedClone;

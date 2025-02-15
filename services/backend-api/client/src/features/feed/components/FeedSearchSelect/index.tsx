import { useLocation, useNavigate, useParams } from "react-router-dom";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import { HStack, Text } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { ThemedSelect } from "@/components";
import { useFeeds } from "../../hooks/useFeeds";
import { FeedSummary } from "../../types";

interface Props {}

export const FeedSearchSelect: React.FC<Props> = () => {
  const navigate = useNavigate();
  const { serverId, feedId } = useParams();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const { status, data, setSearch, search, isFetching } = useFeeds({ serverId });

  const isInitiallyLoading = status === "loading";
  const isSearching = !!search && isFetching;

  const onChangedValue = (newFeedId: string) => {
    if (feedId) {
      navigate(pathname.replace(feedId, newFeedId));
    } else {
      navigate(`/servers/${serverId}/feeds/${newFeedId}/message`);
    }
  };

  const onSearchChange = debounce((value: string) => {
    setSearch(value);
  }, 500);

  let options: Array<{ value: string; label: string; data: FeedSummary }> = [];

  if (search) {
    options =
      data?.results.map((feed) => ({
        value: feed.id,
        label: feed.title,
        data: feed,
      })) || [];
  }

  if (!search && feedId) {
    options =
      data?.results
        .filter((feed) => feed.id === feedId)
        .map((feed) => ({
          value: feed.id,
          label: feed.title,
          data: feed,
        })) || [];
  }

  return (
    <ThemedSelect
      isInvalid={false}
      onChange={onChangedValue}
      loading={isInitiallyLoading || isSearching}
      isDisabled={isInitiallyLoading}
      value={feedId}
      placeholder={
        <HStack alignItems="center">
          <SearchIcon />
          <Text>{t("features.feed.components.feedSearchSelect.placeholder")}</Text>
        </HStack>
      }
      onInputChange={onSearchChange}
      options={options}
    />
  );
};

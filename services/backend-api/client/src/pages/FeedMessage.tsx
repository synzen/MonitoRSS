import { Heading, Stack, Text } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardContent } from "@/components";
import { FeedArticlesPlaceholders, useFeed } from "../features/feed";
import RouteParams from "../types/RouteParams";
import { useUpdateFeed } from "../features/feed/hooks/useUpdateFeed";
import { notifySuccess } from "../utils/notifySuccess";
import { DiscordMessageFormLegacy } from "../features/feedConnections/components/LegacyDiscordMessageForm";
import { DiscordMessageFormDataLegacy } from "../types/discord/DiscordMessageFormDataLegacy";

const FeedMessage: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const {
    feed,
    status: feedStatus,
    error: feedError,
  } = useFeed({
    feedId,
  });
  const { mutateAsync } = useUpdateFeed();
  const { t } = useTranslation();

  const onFormSaved = async (data: DiscordMessageFormDataLegacy) => {
    if (!feedId) {
      return;
    }

    await mutateAsync({
      feedId,
      details: {
        text: data.content,
        embeds: data.embeds,
      },
    });

    notifySuccess(t("common.success.savedChanges"));
  };

  return (
    <Stack>
      <DashboardContent error={feedError} loading={feedStatus === "loading"}>
        <Stack spacing="8">
          <Heading size="lg">{t("pages.message.title")}</Heading>
          <Stack spacing="4">
            <Heading size="md">{t("pages.message.placeholdersSectionTitle")}</Heading>
            <Text>{t("pages.message.placeholdersSectionDescription")}</Text>
            <FeedArticlesPlaceholders feedId={feedId} />
          </Stack>
          <Stack spacing="4">
            <DiscordMessageFormLegacy
              defaultValues={{
                content: feed?.text || "",
                embeds: feed?.embeds,
                splitOptions: null,
                forumThreadTags: null,
                mentions: null,
                channelNewThreadExcludesPreview: false,
              }}
              onClickSave={onFormSaved}
            />
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedMessage;

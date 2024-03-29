import { Stack, Text } from "@chakra-ui/react";
import {
  FiMessageCircle,
  FiFilter,
  FiAtSign,
  FiSliders,
  FiCopy,
  FiGitPullRequest,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { SidebarLink } from "../../../../components/SidebarLink";
import { FeedSearchSelect } from "../FeedSearchSelect";

interface Props {
  currentPath: string;
  serverId: string;
  feedId?: string;
  onChangePath: (path: string) => void;
}

export const SidebarFeedLinks: React.FC<Props> = ({
  currentPath,
  serverId,
  feedId,
  onChangePath,
}) => {
  const { t } = useTranslation();

  const onClickNavLink = (path: string) => {
    onChangePath(path);
  };

  const paths = {
    // FEED_OVERVIEW: `/servers/${serverId}/feeds/${feedId}`,
    FEED_MESSAGES: `/servers/${serverId}/feeds/${feedId}/message`,
    FEED_FILTERS: `/servers/${serverId}/feeds/${feedId}/filters`,
    FEED_COMPARISONS: `/servers/${serverId}/feeds/${feedId}/comparisons`,
    FEED_SUBSCRIBERS: `/servers/${serverId}/feeds/${feedId}/subscribers`,
    FEED_MISC_OPTIONS: `/servers/${serverId}/feeds/${feedId}/misc-options`,
    FEED_CLONE: `/servers/${serverId}/feeds/${feedId}/clone`,
  };

  return (
    <Stack spacing="6">
      <Stack spacing="1">
        <Text
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="widest"
          color="gray.500"
        >
          {t("components.sidebar.feed.manage")}
        </Text>
        <Stack spacing="2" paddingBottom="4">
          <FeedSearchSelect />
          {/* <SidebarLink
            icon={FiHome}
            disabled={!feedId}
            active={!!feedId && currentPath === paths.FEED_OVERVIEW}
            onClick={() => onClickNavLink(paths.FEED_OVERVIEW)}
          >
            {t('components.sidebar.feed.overview')}
          </SidebarLink> */}
          <SidebarLink
            icon={FiMessageCircle}
            disabled={!feedId}
            active={!!feedId && currentPath === paths.FEED_MESSAGES}
            onClick={() => onClickNavLink(paths.FEED_MESSAGES)}
          >
            {t("components.sidebar.feed.message")}
          </SidebarLink>
          <SidebarLink
            disabled={!feedId}
            icon={FiFilter}
            active={!!feedId && currentPath === paths.FEED_FILTERS}
            onClick={() => onClickNavLink(paths.FEED_FILTERS)}
          >
            {t("components.sidebar.feed.filters")}
          </SidebarLink>
          <SidebarLink
            disabled={!feedId}
            icon={FiGitPullRequest}
            active={!!feedId && currentPath === paths.FEED_COMPARISONS}
            onClick={() => onClickNavLink(paths.FEED_COMPARISONS)}
          >
            {t("components.sidebar.feed.comparisons")}
          </SidebarLink>
          <SidebarLink
            disabled={!feedId}
            icon={FiAtSign}
            active={!!feedId && currentPath === paths.FEED_SUBSCRIBERS}
            onClick={() => onClickNavLink(paths.FEED_SUBSCRIBERS)}
          >
            {t("components.sidebar.feed.subscribers")}
          </SidebarLink>
          <SidebarLink
            disabled={!feedId}
            icon={FiSliders}
            active={!!feedId && currentPath === paths.FEED_MISC_OPTIONS}
            onClick={() => onClickNavLink(paths.FEED_MISC_OPTIONS)}
          >
            {t("components.sidebar.feed.miscoptions")}
          </SidebarLink>
          <SidebarLink
            disabled={!feedId}
            icon={FiCopy}
            active={!!feedId && currentPath === paths.FEED_CLONE}
            onClick={() => onClickNavLink(paths.FEED_CLONE)}
          >
            {t("components.sidebar.feed.clone")}
          </SidebarLink>
        </Stack>
      </Stack>
    </Stack>
  );
};

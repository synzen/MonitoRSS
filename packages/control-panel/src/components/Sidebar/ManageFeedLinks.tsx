import {
  Button, Icon, Stack, Text,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import {
  FiHome, FiMessageCircle, FiFilter, FiAtSign, FiSliders, FiShare2, FiArrowLeft,
} from 'react-icons/fi';
import SidebarLink from './SidebarLink';

interface Props {
  currentPath: string
  serverId: string
  feedId: string
  onChangePath: (path: string) => void
}

const ManageFeedLinks: React.FC<Props> = ({
  currentPath, serverId, feedId, onChangePath,
}) => {
  const onClickNavLink = (path: string) => {
    onChangePath(path);
  };

  const paths = {
    FEED_OVERVIEW: `/servers/${serverId}/feeds/${feedId}`,
    FEED_MESSAGES: `/servers/${serverId}/feeds/${feedId}/message`,
    FEED_FILTERS: `/servers/${serverId}/feeds/${feedId}/filters`,
    FEED_SUBSCRIBERS: `/servers/${serverId}/feeds/${feedId}/subscribers`,
    FEED_MISC_OPTIONS: `/servers/${serverId}/feeds/${feedId}/misc-options`,
  };

  return (
    <Stack spacing="6">
      <Button
        as={Link}
        to={`/servers/${serverId}/feeds`}
        leftIcon={<Icon fontSize="lg" as={FiArrowLeft} />}
        variant="solid"
        textAlign="left"
        justifyContent="left"
      >
        Manage Servers
      </Button>
      <Stack spacing="1">
        <Text
          px="3"
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="widest"
          color="gray.500"
          mb="3"
        >
          Manage Feed
        </Text>
        <Stack spacing="2">
          <SidebarLink
            icon={FiHome}
            active={currentPath === paths.FEED_OVERVIEW}
            onClick={() => onClickNavLink(paths.FEED_OVERVIEW)}
          >
            Overview
          </SidebarLink>
          <SidebarLink
            icon={FiMessageCircle}
            active={currentPath === paths.FEED_MESSAGES}
            onClick={() => onClickNavLink(paths.FEED_MESSAGES)}
          >
            Message
          </SidebarLink>
          <SidebarLink
            icon={FiFilter}
            active={currentPath === paths.FEED_FILTERS}
            onClick={() => onClickNavLink(paths.FEED_FILTERS)}
          >
            Filters
          </SidebarLink>
          <SidebarLink
            icon={FiAtSign}
            active={currentPath === paths.FEED_SUBSCRIBERS}
            onClick={() => onClickNavLink(paths.FEED_SUBSCRIBERS)}
          >
            Subscribers
          </SidebarLink>
          <SidebarLink
            disabled
            icon={FiShare2}
            active={currentPath === paths.FEED_MISC_OPTIONS}
            onClick={() => onClickNavLink(paths.FEED_MISC_OPTIONS)}
          >
            Webhooks
          </SidebarLink>
          <SidebarLink
            icon={FiSliders}
            active={currentPath === paths.FEED_MISC_OPTIONS}
            onClick={() => onClickNavLink(paths.FEED_MISC_OPTIONS)}
          >
            Misc Options
          </SidebarLink>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default ManageFeedLinks;

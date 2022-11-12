import {
  Flex,
  Stack,
  Heading,
  Box,
  HStack,
  Text,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FeedsTableV2 } from '../features/feed/components/FeedsTableV2';
import { useDiscordUserMe } from '../features/discordUser';
import { useUserFeeds } from '../features/feed';

const FeedsV2: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    data: discordUserMe,
  } = useDiscordUserMe();
  const {
    data: userFeeds,
  } = useUserFeeds({
    initialLimit: 10,
  });

  const onSelectedFeed = (feedId: string) => {
    navigate(`/v2/feeds/${feedId}`);
  };

  return (
    <Flex
      width="100%"
      height="100%"
      overflow="auto"
      maxWidth="1200px"
    >
      <Stack
        spacing="6"
        flex="1"
        paddingX={{ base: 4, lg: 12 }}
        paddingBottom="12"
        width="100%"
        overflow="auto"
      >
        <Flex
          paddingTop="8"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading size="lg">{t('pages.feeds.title')}</Heading>
          <Box>
            {discordUserMe?.supporter && userFeeds?.total !== undefined
            && (
            <HStack>
              <Text fontSize="lg">
                {userFeeds.total}
              </Text>
              <Text fontSize="lg">
                /
              </Text>
              <Text fontSize="lg">
                {discordUserMe.supporter.maxFeeds}
              </Text>
            </HStack>
            )}
          </Box>
        </Flex>
        <FeedsTableV2
          onSelectedFeedId={onSelectedFeed}
        />
      </Stack>
    </Flex>
  );
};

export default FeedsV2;

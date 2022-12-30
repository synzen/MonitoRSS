import {
  Flex,
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
import { pages } from '../constants';
import { BoxConstrained } from '../components';

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
    navigate(pages.userFeed(feedId));
  };

  return (
    <BoxConstrained.Wrapper>
      <BoxConstrained.Container>
        <Flex
          paddingTop="12"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading size="lg">{t('pages.feeds.title')}</Heading>
          <Box>
            {discordUserMe?.maxUserFeeds !== undefined && userFeeds?.total !== undefined
            && (
            <HStack>
              <Text fontSize="lg">
                {userFeeds.total}
              </Text>
              <Text fontSize="lg">
                /
              </Text>
              <Text fontSize="lg">
                {discordUserMe.maxUserFeeds}
              </Text>
            </HStack>
            )}
          </Box>
        </Flex>
        <FeedsTableV2
          onSelectedFeedId={onSelectedFeed}
        />
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};

export default FeedsV2;

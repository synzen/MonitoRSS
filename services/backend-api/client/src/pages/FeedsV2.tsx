import {
  Flex,
  Heading,
  Box,
  HStack,
  Text,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  Stack,
  Button,
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
      <BoxConstrained.Container paddingTop={10} spacing={6}>
        <Stack>
          <Flex
            justifyContent="space-between"
            alignItems="center"
          >
            <Flex alignItems="center" gap={4}>
              <Heading size="lg">{t('pages.userFeeds.title')}</Heading>
              <Badge colorScheme="purple" fontSize="lg">{t('pages.userFeeds.newBadge')}</Badge>
            </Flex>
            <Box>
              {discordUserMe?.maxUserFeeds !== undefined && userFeeds?.total !== undefined
            && (
              <HStack>
                <Text fontSize="xl" fontWeight={600}>
                  {userFeeds.total}
                </Text>
                <Text fontSize="xl" fontWeight={600}>
                  /
                </Text>
                <Text fontSize="xl" fontWeight={600}>
                  {discordUserMe.maxUserFeeds}
                </Text>
              </HStack>
            )}
            </Box>
          </Flex>
          <Text>
            {t('pages.userFeeds.description')}
          </Text>
        </Stack>
        <Alert
          borderRadius="md"
          colorScheme="purple"
          flexDirection="column"
          alignItems="flex-start"
        >
          <AlertTitle>
            {t('pages.userFeeds.supporterOnlyTitle')}
          </AlertTitle>
          <AlertDescription>
            {t('pages.userFeeds.supporterOnlyDescription')}
          </AlertDescription>
          <Button
            marginTop={4}
            variant="outline"
            onClick={() => navigate('/')}
            size="sm"
          >
            Back to legacy feeds

          </Button>
        </Alert>
        <FeedsTableV2
          onSelectedFeedId={onSelectedFeed}
        />
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};

export default FeedsV2;

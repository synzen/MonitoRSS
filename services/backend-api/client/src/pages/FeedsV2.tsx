import {
  Flex,
  Stack,
  Heading,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FeedsTableV2 } from '../features/feed/components/FeedsTableV2';

const FeedsV2: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
        </Flex>
        <FeedsTableV2
          onSelectedFeedId={onSelectedFeed}
        />
      </Stack>
    </Flex>
  );
};

export default FeedsV2;

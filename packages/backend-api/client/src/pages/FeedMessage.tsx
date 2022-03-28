import { Heading, Stack, Text } from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardContent } from '@/components';
import { FeedArticlesPlaceholders, useFeed } from '../features/feed';
import RouteParams from '../types/RouteParams';
import { TextForm } from '@/features/feed/components/TextForm';

const FeedMessage: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const {
    feed, status: feedStatus, error: feedError, refetch,
  } = useFeed({
    feedId,
  });
  const { t } = useTranslation();

  return (
    <Stack>
      <DashboardContent
        error={feedError}
        loading={feedStatus === 'loading' || feedStatus === 'idle'}
      >
        <Stack spacing="8">
          <Heading size="lg">{t('pages.message.title')}</Heading>
          <Stack spacing="4">
            <Heading size="md">{t('pages.message.placeholdersSectionTitle')}</Heading>
            <Text>{t('pages.message.placeholdersSectionDescription')}</Text>
            <FeedArticlesPlaceholders
              feedId={feedId}
            />
          </Stack>
          <Stack spacing="4">
            <Heading size="md">{t('pages.message.textSectionTitle')}</Heading>
            <Text>
              {t('pages.message.textSectionDescription')}
            </Text>
            <TextForm
              feedId={feedId as string}
              text={feed?.text || ''}
              onUpdated={refetch}
            />
          </Stack>
          {/* <Stack spacing="4">
            <Stack direction="row" justifyContent="space-between">
              <Heading size="md">Embeds</Heading>
              <ButtonGroup>
                <IconButton
                  aria-label="previous embed"
                  icon={<ChevronLeftIcon fontSize="xl" />}
                />
                <Text
                  alignSelf="center"
                >
                  1/3
                </Text>
                <IconButton
                  aria-label="next embed"
                  icon={<ChevronRightIcon fontSize="xl" />}
                />
              </ButtonGroup>
            </Stack>
            <EmbedForm />
          </Stack> */}
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedMessage;

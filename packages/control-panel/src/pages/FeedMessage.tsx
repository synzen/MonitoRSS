import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import {
  ButtonGroup,
  Code, Heading, IconButton, Stack, Text,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { DashboardContent, Navbar } from '@/components';
import {
  EmbedForm, FeedArticlesPlaceholders, useFeed,
} from '../features/feed';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';
import { TextForm } from '@/features/feed/components/TextForm';

const FeedMessage: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const {
    feed, status: feedStatus, error: feedError, refetch,
  } = useFeed({
    feedId,
  });

  const breadcrumbItems: Array<NavbarBreadcrumbItem> = [{
    id: 'feeds',
    content: 'Feeds',
    enabled: true,
  }, {
    id: 'feed',
    content: feed?.title,
    enabled: true,
  }, {
    id: 'message',
    content: 'Message',
    enabled: true,
  }];

  return (
    <Stack>
      <Navbar breadcrumbItems={breadcrumbItems} />
      <DashboardContent
        error={feedError}
        loading={feedStatus === 'loading' || feedStatus === 'idle'}
      >
        <Stack spacing="8">
          <Stack spacing="4">
            <Heading size="md">Placeholders</Heading>
            <Text>Below are the available placeholders for the selected article.</Text>
            <FeedArticlesPlaceholders
              feedId={feedId}
            />
          </Stack>
          <Stack spacing="4">
            <Heading size="md">Text</Heading>
            <Text>
              {'You can use the placeholders listed above. A special placeholder, '}
              <Code>{'{empty}'}</Code>
              {' can be'
              + ' used to create an empty message, but only if an embed is used. Regular formatting'
              + ' such as bold and etc. is also available.'}
            </Text>
            <TextForm
              feedId={feedId as string}
              text={feed?.text || ''}
              onUpdated={refetch}
            />
          </Stack>
          <Stack spacing="4">
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
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedMessage;

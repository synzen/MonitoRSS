import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import {
  ButtonGroup,
  Code, Heading, IconButton, Stack, Text, Textarea,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import DashboardContent from '../components/DashboardContent';
import EmbedForm from '../components/EmbedForm';
import FeedArticlesPlaceholders from '../components/FeedArticlesPlaceholders';
import Navbar from '../components/Navbar';
import useFeed from '../hooks/useFeed';
import useFeedArticles from '../hooks/useFeedArticles';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const FeedMessage: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { feed, status: feedStatus, error: feedError } = useFeed({
    feedId,
  });
  const { articles, status: articlesStatus, error: articlesError } = useFeedArticles({ feedId });

  const breadcrumbItems: Array<NavbarBreadcrumbItem> = [{
    id: 'feeds',
    content: 'Feeds',
    enabled: true,
  }, {
    id: 'feed',
    content: feedId,
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
              articles={articles}
              loading={articlesStatus === 'loading' || articlesStatus === 'idle'}
              error={articlesError}
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
            <Textarea />
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

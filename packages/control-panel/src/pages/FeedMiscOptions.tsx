import {
  Checkbox,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { DashboardContent, Navbar } from '@/components';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const miscOptions = [{
  key: 'title-checks',
  title: 'Title Checks',
  description: 'ONLY ENABLE THIS IF NECESSARY! Title checks will ensure no article with the '
  + 'same title as a previous one will be sent for a specific feed.',
}, {
  key: 'date-checks',
  title: 'Date Checks',
  description: 'Date checking ensures that articles that are either older than 1 day or has'
  + ' invalid/no published dates are never sent. This MUST be disabled for feeds with no'
  + ' {date} placeholder for any articles to be delivered..',
}, {
  key: 'image-links-preview',
  title: 'Image Links Preview',
  description: 'Toggle automatic Discord image link embedded previews for image links'
  + ' found inside placeholders such as {description}.',
}, {
  key: 'image-links-existence',
  title: 'Image Links Existence',
  description: 'Remove image links found inside placeholders such as {description}. If disabled,'
   + 'all image src links in such placeholders will be removed.',
}, {
  key: 'tables-support',
  title: 'Tables Support',
  description: 'If table formatting is enabled, they should be enclosed in code blocks to'
  + ' ensure uniform spacing.',
}];

const FeedMiscOptions: React.FC = () => {
  const { feedId } = useParams<RouteParams>();

  const breadcrumbItems: Array<NavbarBreadcrumbItem> = [{
    id: 'feeds',
    content: 'Feeds',
    enabled: true,
  }, {
    id: 'feed',
    content: feedId,
    enabled: true,
  }, {
    id: 'miscoptions',
    content: 'Misc Options',
    enabled: true,
  }];

  return (
    <Stack>
      <Navbar breadcrumbItems={breadcrumbItems} />
      <DashboardContent>
        <Stack spacing="12">
          <Stack spacing="8">
            {miscOptions.map((option) => (
              <HStack key={option.key}>

                <Stack>
                  <HStack>
                    <Checkbox size="lg" />
                    <Heading as="h2" size="md">
                      {option.title}
                    </Heading>
                  </HStack>
                  <Text>
                    {option.description}
                  </Text>
                </Stack>
              </HStack>
            ))}
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedMiscOptions;

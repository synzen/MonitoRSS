import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import {
  ButtonGroup,
  Code, Heading, IconButton, Select, Stack, StackDivider, Text, Textarea,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import DashboardContent from '../components/DashboardContent';
import EmbedForm from '../components/EmbedForm';
import Navbar from '../components/Navbar';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const fakeArticle = {
  placeholders: [{
    name: 'title',
    value: 'My Feed',
  }, {
    name: 'description',
    value: 'This is a description',
  }, {
    name: 'url',
    value: 'https://www.example.com',
  }, {
    name: 'image1',
    value: 'https://www.example.com/image1.png',
  }, {
    name: 'image2',
    value: 'https://www.example.com/image2.png',
  }, {
    name: 'image3',
    value: 'https://www.example.com/image3.png',
  }],
};

const FeedMessage: React.FC = () => {
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
    id: 'message',
    content: 'Message',
    enabled: true,
  }];

  return (
    <Stack>
      <Navbar breadcrumbItems={breadcrumbItems} />
      <DashboardContent>
        <Stack spacing="8">
          <Stack spacing="4">
            <Heading size="md">Placeholders</Heading>
            <Text>Below are the available placeholders for the selected article.</Text>
            <Select>
              <option>Option 1</option>
              <option>Option 2</option>
            </Select>
            <Stack
              borderRadius="8"
              borderStyle="solid"
              borderWidth="1px"
              maxHeight="350px"
              padding="4"
              overflow="auto"
              divider={<StackDivider />}
            >
              {fakeArticle.placeholders.map((placeholder) => (
                <Stack display="inline-block" key={placeholder.value}>
                  <Code>{placeholder.name}</Code>
                  <Text>{placeholder.value}</Text>
                </Stack>
              ))}
            </Stack>
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

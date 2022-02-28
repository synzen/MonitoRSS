import {
  Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useBreakpointValue, UseTabsProps,
} from '@chakra-ui/react';
import EmbedAuthorInput from './EmbedAuthorInput';
import EmbedColorInput from './EmbedColorInput';
import EmbedDescriptionInput from './EmbedDescriptionInput';
import EmbedFieldsInput from './EmbedFieldsInput';
import EmbedFooterInput from './EmbedFooterInput';
import EmbedImageInput from './EmbedImageInput';
import EmbedTitleInput from './EmbedTitleInput';

export const EmbedForm: React.FC = () => {
  const tabOrientation = useBreakpointValue<UseTabsProps['orientation']>({
    base: 'horizontal',
    md: 'vertical',
  });

  const tabs = [{
    title: 'Title',
    content: <EmbedTitleInput />,
  }, {
    title: 'Author',
    content: <EmbedAuthorInput />,
  }, {
    title: 'Description',
    content: <EmbedDescriptionInput />,
  }, {
    title: 'Image',
    content: <EmbedImageInput />,
  }, {
    title: 'Footer',
    content: <EmbedFooterInput />,
  }, {
    title: 'Color',
    content: <EmbedColorInput />,
  }, {
    title: 'Fields',
    content: <EmbedFieldsInput />,
  }];

  return (
    <Stack spacing="4">
      <Text>Description here.</Text>
      <Tabs orientation={tabOrientation}>
        <TabList>
          {tabs.map((tab) => (
            <Tab
              key={tab.title}
              justifyContent="left"
            >
              {tab.title}

            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {tabs.map((tab) => (
            <TabPanel
              paddingX="8"
              paddingY={tabOrientation === 'horizontal' ? '8' : '0'}
              key={tab.title}
            >
              {tab.content}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </Stack>
  );
};

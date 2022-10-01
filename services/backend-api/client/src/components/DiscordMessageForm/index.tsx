import { AddIcon } from '@chakra-ui/icons';
import {
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { notifyError } from '../../utils/notifyError';
import { ContentForm } from './ContentForm';
import { EmbedForm } from './EmbedForm';
import {
  DiscordMessageEmbedFormData,
  DiscordMessageFormData,
  discordMessageFormSchema,
} from './types';

interface Props {
  defaultValues?: DiscordMessageFormData
  onClickSave: (data: DiscordMessageFormData) => void
}

const templateEmbed: DiscordMessageEmbedFormData = Object.freeze({
  embedAuthorIconUrl: '',
  embedAuthorTitle: '',
  embedAuthorUrl: '',
  embedColor: undefined,
  embedDescription: '',
  embedFooterIconUrl: '',
  embedFooterText: '',
  embedImageUrl: '',
  embedThumbnailUrl: '',
  embedTitle: '',
  embedUrl: '',
});

export const DiscordMessageForm = ({
  defaultValues,
  onClickSave,
}: Props) => {
  const { t } = useTranslation();
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(defaultValues?.embeds?.length ?? 0);

  const {
    handleSubmit,
    control,
    reset,
    formState: {
      isDirty,
      isSubmitting,
      errors,
    },
    setValue,
  } = useForm<DiscordMessageFormData>({
    resolver: yupResolver(discordMessageFormSchema),
    defaultValues,
    mode: 'onChange',
  });
  const currentEmbeds = useWatch({
    control,
    name: 'embeds',
  });

  const onSubmit = async (formData: DiscordMessageFormData) => {
    try {
      onClickSave(formData);
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  const onAddEmbed = () => {
    const newEmbeds = [...(currentEmbeds || []), {
      ...templateEmbed,
    }];

    setValue('embeds', newEmbeds);
    setActiveEmbedIndex(newEmbeds.length - 1);
  };

  const onRemoveEmbed = (index: number) => {
    const newEmbeds = [...(currentEmbeds || [])];
    newEmbeds.splice(index, 1);

    setValue('embeds', newEmbeds);
    const newIndex = Math.max(index - 1, 0);
    setActiveEmbedIndex(newIndex);
  };

  const onEmbedTabChanged = (index: number) => {
    setActiveEmbedIndex(index);
  };

  const errorsExist = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={16}>
        <Stack spacing={4}>
          <Heading size="md">Text</Heading>
          <ContentForm
            control={control}
            errors={errors}
          />
        </Stack>
        <Stack spacing={4}>
          <Heading size="md">Embeds</Heading>
          <Tabs
            variant="soft-rounded"
            index={activeEmbedIndex}
            onChange={onEmbedTabChanged}
          >
            <HStack overflow="auto">
              <TabList>
                {currentEmbeds?.map((_, index) => (
                  <Tab key={index as any}>
                    Embed
                    {' '}
                    {index + 1}
                  </Tab>
                ))}
              </TabList>
              {(currentEmbeds?.length ?? 0) < 10 && (
                <IconButton
                  onClick={onAddEmbed}
                  variant="ghost"
                  aria-label="Add new embed"
                  icon={<AddIcon />}
                />
              )}
            </HStack>
            <TabPanels>
              {currentEmbeds?.map((embed, index) => (
                <TabPanel key={index as any}>
                  <Flex justifyContent="flex-end">
                    <Button
                      colorScheme="red"
                      variant="outline"
                      onClick={() => onRemoveEmbed(index)}
                    >
                      Delete Embed

                    </Button>
                  </Flex>
                  <EmbedForm
                    control={control}
                    index={index}
                    errors={errors}
                  />
                </TabPanel>
              ))}
            </TabPanels>
          </Tabs>
        </Stack>
        <Flex direction="row-reverse">
          <HStack>
            <Button
              onClick={() => reset()}
              variant="ghost"
              disabled={!isDirty || isSubmitting}
            >
              {t('features.feed.components.sidebar.resetButton')}
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              disabled={isSubmitting || !isDirty || errorsExist}
              isLoading={isSubmitting}
            >
              {t('features.feed.components.sidebar.saveButton')}
            </Button>
          </HStack>
        </Flex>
      </Stack>
    </form>
  );
};

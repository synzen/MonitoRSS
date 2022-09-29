import {
  Box,
  Button,
  Flex,
  FormLabel,
  HStack,
  Input,
  Stack,
  StackDivider,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { InferType, object, string } from 'yup';
import { notifyError } from '../../utils/notifyError';

const formSchema = object({
  content: string(),
  embedColor: string(),
  embedAuthorTitle: string(),
  embedAuthorUrl: string(),
  embedAuthorIconUrl: string(),
  embedTitle: string(),
  embedUrl: string(),
  embedDescription: string(),
  embedThumbnailUrl: string(),
  embedImageUrl: string(),
  embedFooterText: string(),
  embedFooterIconUrl: string(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  defaultValues?: FormData
  onClickSave: (data: FormData) => void
}

export const DiscordMessageForm = ({
  defaultValues,
  onClickSave,
}: Props) => {
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: {
      isDirty,
      isSubmitting,
    },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });

  const resetForm = () => {
    reset(defaultValues);
  };

  const onSubmit = async (formData: FormData) => {
    try {
      onClickSave(formData);
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  useEffect(() => {
    resetForm();
  }, [defaultValues]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing="5">
        <Stack spacing="5" divider={<StackDivider />}>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Content</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Text</FormLabel>
                  <Controller
                    name="content"
                    control={control}
                    render={({ field }) => (
                      <Textarea {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Embed Color</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Hex</FormLabel>
                  <Controller
                    name="embedColor"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Embed Author</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Title</FormLabel>
                  <Controller
                    name="embedAuthorTitle"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">URL</FormLabel>
                  <Controller
                    name="embedAuthorUrl"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Icon URL</FormLabel>
                  <Controller
                    name="embedAuthorIconUrl"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Embed Title</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Title</FormLabel>
                  <Controller
                    name="embedTitle"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">URL</FormLabel>
                  <Controller
                    name="embedUrl"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Embed Description</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Text</FormLabel>
                  <Controller
                    name="embedDescription"
                    control={control}
                    render={({ field }) => (
                      <Textarea {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Embed Image</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Image URL</FormLabel>
                  <Controller
                    name="embedImageUrl"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Embed Thumbnail</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Image URL</FormLabel>
                  <Controller
                    name="embedThumbnailUrl"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
          <Box>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: '1.5', md: '8' }}
              justify="space-between"
            >
              <Text>Embed Footer</Text>
              <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">Text</FormLabel>
                  <Controller
                    name="embedFooterText"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
                <Stack
                  display="flex"
                  width="100%"
                  alignSelf="flex-end"
                >
                  <FormLabel variant="inline">
                    Icon URL
                  </FormLabel>
                  <Controller
                    name="embedFooterIconUrl"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Box>
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
                disabled={isSubmitting || !isDirty}
                isLoading={isSubmitting}
              >
                {t('features.feed.components.sidebar.saveButton')}
              </Button>
            </HStack>
          </Flex>
        </Stack>
      </Stack>
    </form>
  );
};

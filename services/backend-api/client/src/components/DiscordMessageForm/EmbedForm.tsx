import {
  Box,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Stack,
  StackDivider,
  Textarea,
} from '@chakra-ui/react';
import { useEffect } from 'react';
import {
  Controller, FieldError, useFormContext, useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EMBED_REQUIRES_ONE_OF, EMBED_REQUIRES_ONE_OF_ERROR_KEY } from './constants';
import { DiscordMessageEmbedFormData, DiscordMessageFormData } from './types';

interface Props {
  index: number
}

export const EmbedForm = ({
  index,
}: Props) => {
  const {
    control,
    formState: {
      errors,
    },
    setError,
    clearErrors,
  } = useFormContext<DiscordMessageFormData>();
  const embed = useWatch({
    control,
    name: `embeds.${index}`,
  });
  const { t } = useTranslation();

  useEffect(() => {
    const atLeastOneRequiredValueExists = EMBED_REQUIRES_ONE_OF.some((key) => embed[key]);

    if (!atLeastOneRequiredValueExists) {
      EMBED_REQUIRES_ONE_OF.forEach((key) => {
        setError(`embeds.${index}.${key}` as any, {
          type: EMBED_REQUIRES_ONE_OF_ERROR_KEY,
          message: t('features.feedConnections.components.embedForm.errorOneOfRequiredFields'),
        });
      });
    } else {
      EMBED_REQUIRES_ONE_OF.forEach((key) => {
        clearErrors(`embeds.${index}.${key}` as any);
      });
    }
  }, EMBED_REQUIRES_ONE_OF.map((key) => embed[key]));

  const getEmbedError = (fieldName: keyof DiscordMessageEmbedFormData) => {
    const error: FieldError = (errors.embeds as any)?.[index]?.[fieldName];

    return error ? error.message : undefined;
  };

  const embedColorError = getEmbedError('embedColor');
  const embedAuthorIconUrlError = getEmbedError('embedAuthorIconUrl');
  const embedAuthorTitleError = getEmbedError('embedAuthorTitle');
  const embedAuthorUrlError = getEmbedError('embedAuthorUrl');
  const embedDescriptionError = getEmbedError('embedDescription');
  const embedFooterIconUrlError = getEmbedError('embedFooterIconUrl');
  const embedFooterTextError = getEmbedError('embedFooterText');
  const embedImageUrlError = getEmbedError('embedImageUrl');
  const embedThumbnailUrlError = getEmbedError('embedThumbnailUrl');
  const embedTitleError = getEmbedError('embedTitle');
  const embedUrlError = getEmbedError('embedUrl');

  return (
    <Stack spacing={8}>
      <Stack spacing={8} divider={<StackDivider />}>
        <Box>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: '1.5', md: '8' }}
            justify="space-between"
          >
            <Heading size="sm">Color</Heading>
            <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
              <FormControl isInvalid={!!embedColorError}>
                <FormLabel variant="inline">Hex</FormLabel>
                <Controller
                  name={`embeds.${index}.embedColor`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedColorError && (
                  <FormErrorMessage>{embedColorError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: '1.5', md: '8' }}
            justify="space-between"
          >
            <Heading size="sm">Author</Heading>
            <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
              <FormControl isInvalid={!!embedAuthorTitleError}>
                <FormLabel variant="inline">Title</FormLabel>
                <Controller
                  name={`embeds.${index}.embedAuthorTitle`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedAuthorTitleError && (
                <FormErrorMessage>{embedAuthorTitleError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!embedAuthorUrlError}
              >
                <FormLabel variant="inline">URL</FormLabel>
                <Controller
                  name={`embeds.${index}.embedAuthorUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedAuthorUrlError && (
                <FormErrorMessage>{embedAuthorUrlError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!embedAuthorIconUrlError}
              >
                <FormLabel variant="inline">Icon URL</FormLabel>
                <Controller
                  name={`embeds.${index}.embedAuthorIconUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedAuthorIconUrlError && (
                <FormErrorMessage>{embedAuthorIconUrlError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: '1.5', md: '8' }}
            justify="space-between"
          >
            <Heading size="sm">Title</Heading>
            <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
              <FormControl
                isInvalid={!!embedTitleError}
              >
                <FormLabel variant="inline">Title</FormLabel>
                <Controller
                  name={`embeds.${index}.embedTitle`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedTitleError && (
                <FormErrorMessage>{embedTitleError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!embedUrlError}
              >
                <FormLabel variant="inline">URL</FormLabel>
                <Controller
                  name={`embeds.${index}.embedUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedUrlError && (
                <FormErrorMessage>{embedUrlError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: '1.5', md: '8' }}
            justify="space-between"
          >
            <Heading size="sm">Description</Heading>
            <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
              <FormControl
                isInvalid={!!embedDescriptionError}
              >
                <FormLabel variant="inline">Text</FormLabel>
                <Controller
                  name={`embeds.${index}.embedDescription`}
                  control={control}
                  render={({ field }) => (
                    <Textarea {...field} />
                  )}
                />
                {embedDescriptionError && (
                <FormErrorMessage>{embedDescriptionError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: '1.5', md: '8' }}
            justify="space-between"
          >
            <Heading size="sm">Image</Heading>
            <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
              <FormControl
                isInvalid={!!embedImageUrlError}
              >
                <FormLabel variant="inline">Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.embedImageUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedImageUrlError && (
                <FormErrorMessage>{embedImageUrlError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: '1.5', md: '8' }}
            justify="space-between"
          >
            <Heading size="sm">Thumbnail</Heading>
            <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
              <FormControl
                isInvalid={!!embedThumbnailUrlError}
              >
                <FormLabel variant="inline">Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.embedThumbnailUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedThumbnailUrlError && (
                <FormErrorMessage>{embedThumbnailUrlError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: '1.5', md: '8' }}
            justify="space-between"
          >
            <Heading size="sm">Footer</Heading>
            <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
              <FormControl
                isInvalid={!!embedFooterTextError}
              >
                <FormLabel variant="inline">Text</FormLabel>
                <Controller
                  name={`embeds.${index}.embedFooterText`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedFooterTextError && (
                <FormErrorMessage>{embedFooterTextError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!embedFooterIconUrlError}
              >
                <FormLabel variant="inline">
                  Icon URL
                </FormLabel>
                <Controller
                  name={`embeds.${index}.embedFooterIconUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {embedFooterIconUrlError && (
                <FormErrorMessage>{embedFooterIconUrlError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
};

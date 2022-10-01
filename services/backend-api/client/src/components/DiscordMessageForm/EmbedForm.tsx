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
import {
  Control, Controller, FieldError, FieldErrorsImpl,
} from 'react-hook-form';
import { DiscordMessageEmbedFormData, DiscordMessageFormData } from './types';

interface Props {
  control: Control<DiscordMessageFormData>
  index: number
  errors: FieldErrorsImpl<DiscordMessageFormData>
}

export const EmbedForm = ({
  control,
  index,
  errors,
}: Props) => {
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
                  <FormErrorMessage color="red.400">{embedColorError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedAuthorTitleError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedAuthorUrlError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedAuthorIconUrlError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedTitleError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedUrlError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedDescriptionError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedImageUrlError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedThumbnailUrlError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedFooterTextError}</FormErrorMessage>
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
                <FormErrorMessage color="red.400">{embedFooterIconUrlError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
};

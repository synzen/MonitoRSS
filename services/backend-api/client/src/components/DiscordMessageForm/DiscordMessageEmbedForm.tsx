import {
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
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
import { DiscordMessageFormData } from '@/types/discord';
import { getNestedField } from '@/utils/getNestedField';
import { EMBED_REQUIRES_ONE_OF, EMBED_REQUIRES_ONE_OF_ERROR_KEY } from './constants';

interface Props {
  index: number
}

export const DiscordMessageEmbedForm = ({
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
    const atLeastOneRequiredValueExists = EMBED_REQUIRES_ONE_OF
      .some((key) => getNestedField(embed, key));

    if (!atLeastOneRequiredValueExists) {
      EMBED_REQUIRES_ONE_OF.forEach((key) => {
        setError(`embeds.${index}.${key}` as any, {
          type: EMBED_REQUIRES_ONE_OF_ERROR_KEY,
          message: t('features.feedConnections.components.embedForm.errorOneOfRequiredFields'),
        });
      });
    } else {
      EMBED_REQUIRES_ONE_OF.forEach((key) => {
        const existingError = getNestedField(
          errors,
          `embeds.${index}.${key}` as any,
        ) as FieldError | undefined;

        if (existingError?.type === EMBED_REQUIRES_ONE_OF_ERROR_KEY) {
          clearErrors(`embeds.${index}.${key}` as any);
        }
      });
    }
  }, EMBED_REQUIRES_ONE_OF.map((key) => getNestedField(embed, key)));

  const getEmbedError = (fieldName: string) => {
    const error: FieldError | undefined = getNestedField(
      (errors.embeds as any)?.[index],
      fieldName,
    );

    return error ? error.message : undefined;
  };

  const colorError = getEmbedError('color');
  const authorIconUrlError = getEmbedError('author.iconUrl');
  const authorNameError = getEmbedError('author.name');
  const authorUrlError = getEmbedError('author.url');
  const descriptionError = getEmbedError('description');
  const footerIconUrlError = getEmbedError('footer.iconUrl');
  const footerTextError = getEmbedError('footer.text');
  const imageUrlError = getEmbedError('image.url');
  const thumbnailUrlError = getEmbedError('thumbnail.url');
  const titleError = getEmbedError('title');
  const urlError = getEmbedError('url');

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
              <FormControl isInvalid={!!colorError}>
                <FormLabel variant="inline">Integer</FormLabel>
                <Controller
                  name={`embeds.${index}.color`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                <FormHelperText>An integer between 0 and 16777215, inclusive</FormHelperText>
                {colorError && (
                  <FormErrorMessage>{colorError}</FormErrorMessage>
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
              <FormControl isInvalid={!!authorNameError}>
                <FormLabel variant="inline">Name</FormLabel>
                <Controller
                  name={`embeds.${index}.author.name`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {authorNameError && (
                <FormErrorMessage>{authorNameError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!authorUrlError}
              >
                <FormLabel variant="inline">URL</FormLabel>
                <Controller
                  name={`embeds.${index}.author.url`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {authorUrlError && (
                <FormErrorMessage>{authorUrlError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!authorIconUrlError}
              >
                <FormLabel variant="inline">Icon URL</FormLabel>
                <Controller
                  name={`embeds.${index}.author.iconUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {authorIconUrlError && (
                <FormErrorMessage>{authorIconUrlError}</FormErrorMessage>
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
                isInvalid={!!titleError}
              >
                <FormLabel variant="inline">Title</FormLabel>
                <Controller
                  name={`embeds.${index}.title`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {titleError && (
                <FormErrorMessage>{titleError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!urlError}
              >
                <FormLabel variant="inline">URL</FormLabel>
                <Controller
                  name={`embeds.${index}.url`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {urlError && (
                <FormErrorMessage>{urlError}</FormErrorMessage>
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
                isInvalid={!!descriptionError}
              >
                <FormLabel variant="inline">Text</FormLabel>
                <Controller
                  name={`embeds.${index}.description`}
                  control={control}
                  render={({ field }) => (
                    <Textarea {...field} />
                  )}
                />
                {descriptionError && (
                <FormErrorMessage>{descriptionError}</FormErrorMessage>
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
                isInvalid={!!imageUrlError}
              >
                <FormLabel variant="inline">Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.image.url`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {imageUrlError && (
                <FormErrorMessage>{imageUrlError}</FormErrorMessage>
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
                isInvalid={!!thumbnailUrlError}
              >
                <FormLabel variant="inline">Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.thumbnail.url`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {thumbnailUrlError && (
                <FormErrorMessage>{thumbnailUrlError}</FormErrorMessage>
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
                isInvalid={!!footerTextError}
              >
                <FormLabel variant="inline">Text</FormLabel>
                <Controller
                  name={`embeds.${index}.footer.text`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {footerTextError && (
                <FormErrorMessage>{footerTextError}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl
                isInvalid={!!footerIconUrlError}
              >
                <FormLabel variant="inline">
                  Icon URL
                </FormLabel>
                <Controller
                  name={`embeds.${index}.footer.iconUrl`}
                  control={control}
                  render={({ field }) => (
                    <Input {...field} />
                  )}
                />
                {footerIconUrlError && (
                <FormErrorMessage>{footerIconUrlError}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
};

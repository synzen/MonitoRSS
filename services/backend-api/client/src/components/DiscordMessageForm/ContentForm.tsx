import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { Control, Controller, FieldErrorsImpl } from 'react-hook-form';
import { DiscordMessageFormData } from './types';

interface Props {
  control: Control<DiscordMessageFormData>
  errors: FieldErrorsImpl<DiscordMessageFormData>
}

export const ContentForm = ({
  control,
  errors,
}: Props) => (
  <Stack
    direction={{ base: 'column', md: 'row' }}
    spacing={{ base: '1.5', md: '8' }}
    justify="space-between"
  >
    <Text>Content</Text>
    <Stack spacing={8} width="100%" maxW={{ md: '3xl' }}>
      <FormControl
        isInvalid={!!errors.content}
      >
        <FormLabel variant="inline">Text</FormLabel>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <Textarea {...field} />
          )}
        />
        {errors.content && (
          <FormErrorMessage color="red.400">
            {errors.content.message}
          </FormErrorMessage>
        )}
      </FormControl>
    </Stack>
  </Stack>
);

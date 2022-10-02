import {
  FormControl,
  FormErrorMessage,
  Stack,
  Textarea,
} from '@chakra-ui/react';
import { Control, Controller, FieldErrorsImpl } from 'react-hook-form';
import { DiscordMessageFormData } from '@/types/discord';

interface Props {
  control: Control<DiscordMessageFormData>
  errors: FieldErrorsImpl<DiscordMessageFormData>
}

export const DiscordMessageContentForm = ({
  control,
  errors,
}: Props) => (
  <Stack spacing={8} width="100%">
    <FormControl
      isInvalid={!!errors.content}
    >
      <Controller
        name="content"
        control={control}
        render={({ field }) => (
          <Textarea aria-label="Text content" spellCheck={false} {...field} />
        )}
      />
      {errors.content && (
      <FormErrorMessage>
        {errors.content.message}
      </FormErrorMessage>
      )}
    </FormControl>
  </Stack>
);

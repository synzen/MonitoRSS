/* eslint-disable react/jsx-props-no-spreading */
import {
  Alert, FormControl, Stack, Textarea, TextareaProps,
} from '@chakra-ui/react';
import { useField } from 'formik';
import { forwardRef } from 'react';
import ResizeTextarea from 'react-textarea-autosize';

interface Props {
  name: string
  textareaProps?: TextareaProps
}

export const AutoResizeTextarea = forwardRef<
HTMLTextAreaElement,
TextareaProps
>((props, ref) => (
  <Textarea
    minH="unset"
    overflow="hidden"
    w="100%"
    resize="none"
    ref={ref}
    minRows={4}
    as={ResizeTextarea}
    {...props}
  />
));

export const FormikTextarea: React.FC<Props> = ({ textareaProps, ...props }) => {
  const [field, meta] = useField(props);

  return (
    <FormControl>
      <Stack>
        <AutoResizeTextarea {...field} {...textareaProps} />
        {meta.touched && meta.error && (
        <Alert status="error">
          {meta.error}
        </Alert>
        )}
      </Stack>

    </FormControl>

  );
};

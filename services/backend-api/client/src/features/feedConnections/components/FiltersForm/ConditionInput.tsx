import {
  FormControl,
  FormErrorMessage,
  Input,
} from '@chakra-ui/react';
import {
  Controller, FieldError, useFormContext,
} from 'react-hook-form';
import { getNestedField } from '../../../../utils/getNestedField';

interface Props {
  controllerName: string
}

export const ConditionInput = ({
  controllerName,
}: Props) => {
  const {
    control,
    formState: {
      errors,
    },
  } = useFormContext();
  // Using bracket notation on the errors object will not work since the prefix is a string
  const error = getNestedField<FieldError>(errors, controllerName);

  return (
    <FormControl isInvalid={!!error}>
      <Controller
        name={controllerName}
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <>
            <Input
              flexGrow={1}
              {...field}
            />
            {error?.type === 'required' && (
            <FormErrorMessage>
              Value is required
            </FormErrorMessage>
            )}
          </>
        )}
      />
    </FormControl>
  );
};

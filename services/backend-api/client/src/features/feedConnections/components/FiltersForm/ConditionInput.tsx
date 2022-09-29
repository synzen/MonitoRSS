import {
  FormControl, FormErrorMessage, Input,
} from '@chakra-ui/react';
import { useState } from 'react';

interface Props {
  defaultValue?: string
  value?: string
  onChange: (value: string) => void
}

export const ConditionInput = ({
  defaultValue,
  onChange,
  value,
}: Props) => {
  const [hasFocused, setHasFocused] = useState(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const hasError = !value && hasFocused;

  return (
    <FormControl isInvalid={hasError}>
      <Input
        onFocus={() => setHasFocused(true)}
        flexGrow={1}
        onChange={onInputChange}
        value={value}
        defaultValue={defaultValue}
      />
      {hasError && <FormErrorMessage>Value is required</FormErrorMessage>}
    </FormControl>
  );
};

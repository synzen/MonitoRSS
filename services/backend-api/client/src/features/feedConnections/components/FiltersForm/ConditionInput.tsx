import {
  FormControl,
  FormErrorMessage,
  Input,
} from '@chakra-ui/react';

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
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const hasError = !value;

  return (
    <FormControl isInvalid={hasError}>
      <Input
        flexGrow={1}
        onChange={onInputChange}
        value={value}
        defaultValue={defaultValue}
      />
      {hasError && <FormErrorMessage>Value is required</FormErrorMessage>}
    </FormControl>
  );
};

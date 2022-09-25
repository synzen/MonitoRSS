import {
  Checkbox,
  FormControl, Input, Stack, Text, Textarea,
} from '@chakra-ui/react';

const EmbedFieldInput = () => (
  <Stack
    backgroundColor="gray.700"
    borderRadius="8"
    padding="4"
    spacing="8"
    minWidth="250px"
  >
    <Text fontWeight="semibold">Field 1</Text>
    <Stack spacing="4">
      <FormControl>
        <Input size="sm" placeholder="Title" aria-label="title" type="text" />
      </FormControl>
      <FormControl>
        <Textarea size="sm" placeholder="Value" aria-label="value" />
      </FormControl>
      <FormControl>
        <Checkbox size="sm">Inline</Checkbox>
      </FormControl>
    </Stack>
  </Stack>
);

export default EmbedFieldInput;

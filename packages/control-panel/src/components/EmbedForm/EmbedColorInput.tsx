import {
  FormControl, FormLabel, Input, Stack,
} from '@chakra-ui/react';

const EmbedColorInput = () => (
  <Stack spacing="4">
    <FormControl>
      <FormLabel htmlFor="color-text">Number</FormLabel>
      <Input id="color-text" type="text" />
    </FormControl>
  </Stack>
);

export default EmbedColorInput;

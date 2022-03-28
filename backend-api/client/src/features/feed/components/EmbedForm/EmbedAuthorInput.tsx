import {
  FormControl, FormLabel, Input, Stack,
} from '@chakra-ui/react';

const EmbedAuthorInput = () => (
  <Stack spacing="4">
    <FormControl>
      <FormLabel htmlFor="author-text">Text</FormLabel>
      <Input id="author-text" type="text" />
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="author-link">Text URL</FormLabel>
      <Input id="author-link" type="url" />
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="author-icon-url">Icon URL</FormLabel>
      <Input id="author-icon-url" type="text" />
    </FormControl>
  </Stack>
);

export default EmbedAuthorInput;

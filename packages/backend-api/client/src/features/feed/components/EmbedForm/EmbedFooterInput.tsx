import {
  FormControl, FormLabel, Input, Select, Stack,
} from '@chakra-ui/react';

const EmbedFooterInput = () => (
  <Stack spacing="4">
    <FormControl>
      <FormLabel htmlFor="footer-text">Text</FormLabel>
      <Input id="footer-text" type="text" />
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="footer-url">Text URL</FormLabel>
      <Input id="footer-url" type="text" />
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="footer-timestamp">Timestamp</FormLabel>
      <Select id="footer-timestamp">
        <option value="none">None</option>
        <option value="now">Now</option>
        <option value="article">Article</option>
      </Select>
    </FormControl>
  </Stack>
);

export default EmbedFooterInput;

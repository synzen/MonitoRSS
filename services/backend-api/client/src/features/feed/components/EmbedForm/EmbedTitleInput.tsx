import { FormControl, FormLabel, Input, Stack } from "@chakra-ui/react";

const EmbedTitleInput = () => (
  <Stack spacing="4">
    <FormControl>
      <FormLabel htmlFor="title-text">Text</FormLabel>
      <Input id="title-text" type="text" />
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="title-url">Text URL</FormLabel>
      <Input id="title-url" type="text" />
    </FormControl>
  </Stack>
);

export default EmbedTitleInput;

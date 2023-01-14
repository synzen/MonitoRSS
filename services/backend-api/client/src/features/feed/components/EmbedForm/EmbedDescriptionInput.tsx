import { FormControl, FormLabel, Stack, Textarea } from "@chakra-ui/react";

const EmbedDescriptionInput = () => (
  <Stack spacing="4">
    <FormControl>
      <FormLabel htmlFor="description-text">Text</FormLabel>
      <Textarea id="description-text" />
    </FormControl>
  </Stack>
);

export default EmbedDescriptionInput;

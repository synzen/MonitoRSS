import { FormControl, FormLabel, Input, Stack } from "@chakra-ui/react";

const EmbedImageInput = () => (
  <Stack spacing="4">
    <FormControl>
      <FormLabel htmlFor="image-url">URL</FormLabel>
      <Input id="image-url" type="text" />
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="tumbnail-image-url">Thumbnail URL</FormLabel>
      <Input id="thumbnail-image-url" type="text" />
    </FormControl>
  </Stack>
);

export default EmbedImageInput;

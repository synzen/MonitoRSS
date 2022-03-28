import { AddIcon } from '@chakra-ui/icons';
import { IconButton, Stack } from '@chakra-ui/react';
import EmbedFieldInput from './EmbedFieldInput';

const EmbedFieldsInput = () => (
  <Stack
    direction="row"
    spacing="4"
    overflow="auto"
    paddingBottom="4"
    paddingRight="4"
  >
    <EmbedFieldInput />
    <EmbedFieldInput />
    <EmbedFieldInput />
    <IconButton
      colorScheme="blue"
      aria-label="Add new embed field"
      alignSelf="center"
      icon={<AddIcon />}
    />
  </Stack>
);

export default EmbedFieldsInput;

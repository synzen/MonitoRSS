import { WarningTwoIcon } from "@chakra-ui/icons";
import { Button, Heading, Stack, Text } from "@chakra-ui/react";
import { pages } from "../constants";

export const NotFound = () => {
  return (
    <Stack
      display="flex"
      flexDir="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      paddingBottom="10rem"
      textAlign="center"
      paddingX="12"
      spacing="6"
    >
      <Stack display="flex" justifyContent="center" alignItems="center">
        <WarningTwoIcon fontSize="8rem" color="yellow.500" />
        <Heading>This page doesn&apos;t exist!</Heading>
        <Text fontSize="lg">Looks like you took a wrong turn.</Text>
        <Button as="a" href={pages.userFeeds()} mt={4}>
          Go Home
        </Button>
      </Stack>
    </Stack>
  );
};

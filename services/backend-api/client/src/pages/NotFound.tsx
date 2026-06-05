import { FaTriangleExclamation } from "react-icons/fa6";
import { Button, Heading, Icon, Stack, Text } from "@chakra-ui/react";
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
      gap="6"
    >
      <Stack display="flex" justifyContent="center" alignItems="center">
        <Icon fontSize="8rem" color="text.warning">
          <FaTriangleExclamation />
        </Icon>
        <Heading>This page doesn&apos;t exist!</Heading>
        <Text fontSize="lg">Looks like you took a wrong turn.</Text>
        <Button asChild mt={4}>
          <a href={pages.userFeeds()}>Go Home</a>
        </Button>
      </Stack>
    </Stack>
  );
};

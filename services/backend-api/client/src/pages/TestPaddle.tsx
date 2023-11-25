import { Button, Heading, Stack } from "@chakra-ui/react";
import { usePaddleCheckout } from "../hooks";

export const TestPaddle = () => {
  usePaddleCheckout({
    onCheckoutSuccess: () => {},
  });

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
        <Heading>This page is just to test Paddle</Heading>
        <Button as="a" href="/" mt={4}>
          Go Home
        </Button>
      </Stack>
    </Stack>
  );
};

import { Navigate } from "react-router-dom";
import { Button, Center, Heading, Stack, Text } from "@chakra-ui/react";
import { useAuth } from "@/features/auth";

const Home: React.FC = () => {
  const { authenticated, authCheckStatus } = useAuth();

  const onClickLogin = () => {
    window.location.href = "/api/v1/discord/login";
  };

  if (authenticated) {
    return <Navigate to="/servers" />;
  }

  return (
    <Center mx="8" height="100%">
      <Stack>
        <Heading>Monito.RSS</Heading>
        <Text> Control Panel</Text>
        <br />
        <br />
        <br />
        <Button
          marginTop="8"
          size="lg"
          isLoading={authCheckStatus === "loading"}
          onClick={onClickLogin}
        >
          Login
        </Button>
      </Stack>
    </Center>
  );
};

export default Home;

import { SearchIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertIcon,
  Box,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Loading, Menu } from "@/components";
import { useDiscordServers } from "../features/discordServers";

const Servers: React.FC = () => {
  const navigate = useNavigate();
  const { status, data, error } = useDiscordServers();
  const [search, setSearch] = useState("");

  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      width="100%"
      px="8"
      // marginTop="8rem"
    >
      <Stack maxWidth="lg" width="100%" paddingTop={8} paddingBottom={8}>
        <Stack spacing={8}>
          <Heading>Select your server</Heading>
          <Stack
            spacing={4}
            bg={useColorModeValue("white", "gray.700")}
            padding="4"
            rounded="lg"
            shadow="lg"
            height="500px"
          >
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input placeholder="Search..." onChange={(e) => setSearch(e.target.value)} />
            </InputGroup>
            {status === "loading" && (
              <Box textAlign="center">
                <Loading size="lg" />
              </Box>
            )}
            {status === "success" && data && (
              <Box overflow="auto" height="100%">
                <Menu
                  items={data.results
                    .filter((server) =>
                      search ? server.name.toLowerCase().includes(search.toLowerCase()) : true
                    )
                    .map((server) => ({
                      id: server.id,
                      title: server.name,
                      value: server.id,
                      description: "",
                      icon: server.iconUrl,
                    }))}
                  onSelectedValue={(value) => navigate(`/servers/${value}/feeds`)}
                  shown
                />
              </Box>
            )}
            {error && (
              <Alert status="error" title="Failed to get list of servers">
                <AlertIcon />
                {error.message}
              </Alert>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Flex>
  );
};

export default Servers;

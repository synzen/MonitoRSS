import { ChevronLeftIcon, SearchIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Box,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Link as ChakraLink,
  Stack,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { Loading, Menu } from '@/components';
import { useDiscordServers } from '../features/discordServers';

const Servers: React.FC = () => {
  const navigate = useNavigate();
  const {
    status,
    data,
    error,
  } = useDiscordServers();

  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      width="100%"
      height="100vh"
    >
      <Stack
        maxWidth="lg"
        width="100%"
        paddingTop={8}
        paddingBottom={8}
      >
        <ChakraLink as={Link} to="/" display="inline">
          <ChevronLeftIcon />
          Back
        </ChakraLink>
        <Stack spacing={8}>
          <Heading>Select your server</Heading>
          <Stack
            spacing={4}
            bg={useColorModeValue('white', 'gray.700')}
            padding="4"
            rounded="lg"
            shadow="lg"
          >
            <InputGroup>
              <InputLeftElement
                pointerEvents="none"
              >
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input placeholder="Search..." />
            </InputGroup>
            {status === 'loading' && (
              <Box textAlign="center">
                <Loading size="lg" />
              </Box>
            )}
            {status === 'success' && data && (
              <Menu
                items={data.results.map((server) => ({
                  id: server.id,
                  title: server.name,
                  value: server.id,
                  description: '',
                  icon: server.icon,
                }))}
                onSelectedValue={(value) => navigate(`/servers/${value}/feeds`)}
                shown
              />
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

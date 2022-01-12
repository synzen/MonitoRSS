import { useState } from 'react';
import './App.css';
import {
  Flex, Heading, Input, InputGroup, InputLeftElement, Stack,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import Menu from './components/Menu';

const App: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      width="100%"
      height="100vh"
    >
      <Stack maxWidth="600px" width="100%" spacing={8}>
        <Heading>Select your server</Heading>
        <Stack spacing={4}>
          <InputGroup>
            <InputLeftElement
              pointerEvents="none"
            >
              <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input placeholder="Search..." />
          </InputGroup>
          <Menu />
        </Stack>
      </Stack>
    </Flex>
  );
};

export default App;

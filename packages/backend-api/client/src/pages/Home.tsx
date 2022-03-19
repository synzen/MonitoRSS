import { Button, Flex } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => (
  <Flex
    width="100%"
    height="100vh"
    justifyContent="center"
    alignItems="center"
    flexDir="column"
  >
    Home
    <Link to="/servers">
      <Button>
        Servers
      </Button>
    </Link>
  </Flex>
);

export default Home;

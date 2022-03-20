import './App.css';
import {
  Box, Alert, AlertTitle, AlertIcon,
} from '@chakra-ui/react';
import Pages from './pages';

const App: React.FC = () => (
  <Box
    display="flex"
    flexDir="column"
    height="100vh"
  >
    <Alert status="warning" justifyContent="center">
      <AlertIcon />
      <AlertTitle>
        This control panel is still under development! Features are expected to be missing.
      </AlertTitle>
    </Alert>
    <Box flex="1">
      <Pages />
    </Box>
  </Box>
);

export default App;

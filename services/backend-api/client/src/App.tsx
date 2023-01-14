import "./App.css";
import { Box, Alert, AlertTitle } from "@chakra-ui/react";
import Pages from "./pages";

const App: React.FC = () => (
  <Box display="flex" flexDir="column" height="100vh">
    <Alert status="warning" textAlign="center" minHeight="50px" overflow="auto">
      <AlertTitle textAlign="center" whiteSpace="nowrap" width="100%">
        This control panel is still under development! Features are expected to be missing.
      </AlertTitle>
    </Alert>
    <Box flex="1" height="calc(100% - 50px)">
      <Pages />
    </Box>
  </Box>
);

export default App;

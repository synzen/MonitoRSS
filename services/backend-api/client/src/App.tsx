import "./App.css";
import "./discord.css";
import { Alert, AlertTitle, Box } from "@chakra-ui/react";
import Pages from "./pages";
import { SendTestArticleProvider } from "./contexts";

const App: React.FC = () => {
  return (
    <Box display="flex" flexDir="column" height="100vh" className="he">
      <Alert status="warning" textAlign="center" minHeight="50px" overflow="auto">
        <AlertTitle textAlign="center" whiteSpace="nowrap" width="100%">
          This control panel is still under development! Features are expected to be missing.
        </AlertTitle>
      </Alert>
      <SendTestArticleProvider>
        <Pages />
      </SendTestArticleProvider>
    </Box>
  );
};

export default App;

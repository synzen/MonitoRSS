import "./App.css";
import "./discord.css";
import { Box } from "@chakra-ui/react";
import Pages from "./pages";
import { SendTestArticleProvider } from "./contexts";

const App: React.FC = () => {
  return (
    <Box display="flex" flexDir="column" height="100vh" className="he">
      <SendTestArticleProvider>
        <Pages />
      </SendTestArticleProvider>
    </Box>
  );
};

export default App;

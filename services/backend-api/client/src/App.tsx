import "./App.css";
import "./discord.css";
import { Box } from "@chakra-ui/react";

import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import dayjs from "dayjs";
import { SendTestArticleProvider } from "./contexts";
import Pages from "./pages";
import { AccessibleNavigationAnnouncer } from "./components/AccessibleNavigationAnnouncer";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
dayjs.extend(duration);
dayjs.extend(relativeTime);

const App: React.FC = () => {
  return (
    <Box display="flex" flexDir="column" height="100vh" className="he">
      <AccessibleNavigationAnnouncer />
      <SendTestArticleProvider>
        <Pages />
      </SendTestArticleProvider>
    </Box>
  );
};

export default App;

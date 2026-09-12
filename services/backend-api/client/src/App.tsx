import "./App.css";
import "./discord.css";
import { Box } from "@chakra-ui/react";

import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import dayjs from "dayjs";
import { SendTestArticleProvider } from "./features/feedConnections/discordChannel/messageBuilder/contexts/SendTestArticleContext";
import Pages from "./pages";
import { ScopeNavigationContainer } from "./pages/ScopeNavigationContainer";
import { AccessibleNavigationAnnouncer } from "./components/AccessibleNavigationAnnouncer";
import { AppLegalFooter } from "./components/AppLegalFooter";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
dayjs.extend(duration);
dayjs.extend(relativeTime);

const App: React.FC = () => {
  return (
    <Box display="flex" flexDir="column" height="100dvh">
      <AccessibleNavigationAnnouncer />
      {/* Block-level scroll root: page content must never flex-shrink inside it.
          position:relative keeps positioned page content (e.g. Chakra tables) inside
          this clip — otherwise it escapes to <body> and inflates document scroll. */}
      <Box flex="1" minH="0" overflowY="auto" position="relative">
        <SendTestArticleProvider>
          <ScopeNavigationContainer>
            {/* minHeight (not height) lets the footer pin to the viewport bottom on
                short pages via mt=auto while still flowing after long content. */}
            <Box display="flex" flexDir="column" minHeight="100%">
              <Pages />
              <AppLegalFooter />
            </Box>
          </ScopeNavigationContainer>
        </SendTestArticleProvider>
      </Box>
    </Box>
  );
};

export default App;

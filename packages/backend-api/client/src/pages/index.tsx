import {
  Route, Routes,
} from 'react-router-dom';
import Feed from './Feed';
import FeedFilters from './FeedFilters';
import FeedMessage from './FeedMessage';
import FeedMiscOptions from './FeedMiscOptions';
import Feeds from './Feeds';
import FeedSubscribers from './FeedSubscribers';
import Home from './Home';
import ServerDasboard from './ServerDashboard';
import Servers from './Servers';
import { RequireAuth } from '@/features/auth';
import { PageContent } from '@/components/PageContent';
// import Webhooks from './Webhooks';
import { ServerSettings } from './ServerSettings';
import FeedClone from './FeedClone';

const Pages: React.FC = () => (
  <Routes>
    <Route
      path="/"
      element={<Home />}
    />
    <Route
      path="/servers"
      element={(
        <RequireAuth>
          <Servers />
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId"
      element={(
        <RequireAuth>
          <PageContent>
            <ServerDasboard />
          </PageContent>
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId/settings"
      element={(
        <RequireAuth>
          <PageContent>
            <ServerSettings />
          </PageContent>
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId/feeds"
      element={(
        <RequireAuth>
          <PageContent>
            <Feeds />
          </PageContent>
        </RequireAuth>
    )}
    />
    {/* <Route
      path="/servers/:serverId/webhooks"
      element={(
        <RequireAuth>
          <PageContent>
            <Webhooks />
          </PageContent>
        </RequireAuth>
    )}
    /> */}
    <Route
      path="/servers/:serverId/feeds/:feedId"
      element={(
        <RequireAuth>
          <PageContent requireFeed>
            <Feed />
          </PageContent>
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/message"
      element={(
        <RequireAuth>
          <PageContent requireFeed>
            <FeedMessage />
          </PageContent>
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/filters"
      element={(
        <RequireAuth>
          <PageContent requireFeed>
            <FeedFilters />
          </PageContent>
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/subscribers"
      element={(
        <RequireAuth>
          <PageContent requireFeed>
            <FeedSubscribers />
          </PageContent>
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/misc-options"
      element={(
        <RequireAuth>
          <PageContent requireFeed>
            <FeedMiscOptions />
          </PageContent>
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/clone"
      element={(
        <RequireAuth>
          <PageContent requireFeed>
            <FeedClone />
          </PageContent>
        </RequireAuth>
    )}
    />
  </Routes>
);

export default Pages;

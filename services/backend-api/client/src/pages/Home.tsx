import { Navigate } from "react-router-dom";
import { useUserMe } from "../features/discordUser";
import { pages } from "../constants";

const Home: React.FC = () => {
  const { data } = useUserMe();

  if (!data) {
    // This should be handled by the parent RequireAuth component
    return null;
  }

  if (data.result.migratedToPersonalFeeds) {
    return <Navigate to={pages.userFeeds()} />;
  }

  return <Navigate to="/servers" />;
};

export default Home;

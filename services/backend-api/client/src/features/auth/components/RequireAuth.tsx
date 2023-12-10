import { Center, Heading, Stack } from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loading } from "@/components";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useDiscordAuthStatus, useUserMe } from "../../discordUser";

interface Props {
  children?: React.ReactNode;
  waitForUserFetch?: boolean;
}

export const RequireAuth = ({ children, waitForUserFetch }: Props) => {
  const { data: authStatusData, status: authStatus, error: authError } = useDiscordAuthStatus();
  const { status: userMeStatus } = useUserMe({
    enabled: waitForUserFetch && authStatusData?.authenticated,
  });
  const { t } = useTranslation();

  const isLoading = authStatus === "loading" || userMeStatus === "loading";

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" height="100%" spacing="2rem">
        <Loading size="xl" />
        <Heading>{t("pages.checkingLogin.title")}</Heading>
      </Stack>
    );
  }

  if (authStatus === "error") {
    return (
      <Center height="100%">
        <ErrorAlert description={authError?.message} />
      </Center>
    );
  }

  if (authStatus === "success" && !authStatusData?.authenticated) {
    const currentPath = window.location.pathname;
    const jsonState = JSON.stringify({
      path: currentPath,
    });

    window.location.href = `/api/v1/discord/login-v2?jsonState=${encodeURIComponent(jsonState)}`;

    return null;
  }

  if (authStatus === "success" && authStatusData?.authenticated) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return <Navigate to="/" />;
};

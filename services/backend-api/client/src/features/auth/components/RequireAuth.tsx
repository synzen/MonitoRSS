import { Center, Heading, Stack } from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loading } from "@/components";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useDiscordAuthStatus } from "../../discordUser";

interface Props {
  children?: React.ReactNode;
}

export const RequireAuth = ({ children }: Props) => {
  const { data: authStatusData, status: authStatus, error: authError } = useDiscordAuthStatus();
  const { t } = useTranslation();

  if (authStatus === "loading") {
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
    console.log("🚀 ~ file: RequireAuth.tsx:34 ~ RequireAuth ~ authStatusData:", authStatusData);
    console.log("🚀 ~ file: RequireAuth.tsx:34 ~ RequireAuth ~ authStatus:", authStatus);

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

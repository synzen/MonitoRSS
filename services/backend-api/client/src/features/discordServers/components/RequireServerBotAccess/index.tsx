/* eslint-disable react/jsx-no-useless-fragment */
import { Alert, Box, Center, Flex } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Loading } from "@/components";
import { useDiscordServerAccessStatus } from "../../hooks";
import { ErrorAlert } from "@/components/ErrorAlert";

interface Props {
  serverId?: string;
  children?: React.ReactNode;
}

export const RequireServerBotAccess = ({ serverId, children }: Props) => {
  const { t } = useTranslation();
  const { data, error, status } = useDiscordServerAccessStatus({ serverId });

  if (status === "loading") {
    return (
      <Center width="100%" paddingY="32" paddingX="8">
        <Loading size="lg" />
      </Center>
    );
  }

  if (status === "error") {
    return <ErrorAlert description={error?.message} />;
  }

  if (data && !data.result.authorized) {
    return (
      <Flex width="100%" justifyContent="center">
        <Box
          maxWidth="7xl"
          width="100%"
          paddingX={{ base: 4, lg: 12 }}
          paddingTop="8"
          paddingBottom="16"
        >
          <Alert.Root
            status="warning"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            height="200px"
          >
            <Alert.Indicator boxSize="40px" mr={0} />
            <Alert.Title mt={4} mb={1} fontSize="lg">
              {t("common.api.missingBotAccessTitle")}
            </Alert.Title>
            <Alert.Description>{t("common.api.missingBotAccessMessage")}</Alert.Description>
          </Alert.Root>
        </Box>
      </Flex>
    );
  }

  return <>{children}</>;
};

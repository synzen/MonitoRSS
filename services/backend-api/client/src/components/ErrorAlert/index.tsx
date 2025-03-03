import { WarningTwoIcon } from "@chakra-ui/icons";
import { Divider, Heading, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface Props {
  description?: string;
}

export const ErrorAlert: React.FC<Props> = ({ description }) => {
  const { t } = useTranslation();

  const isGoogleTranslateUsed = !!document.getElementById("goog-gt-tt");

  return (
    <Stack
      display="flex"
      flexDir="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      paddingBottom="10rem"
      textAlign="center"
      paddingX="12"
      spacing="6"
      role="alert"
    >
      <Stack display="flex" justifyContent="center" alignItems="center">
        <WarningTwoIcon fontSize="8rem" color="red.500" />
        <Heading>{t("common.errors.somethingWentWrong")}</Heading>
        <Text fontSize="lg">{t("common.errors.tryAgainLater")}</Text>
      </Stack>
      {description && (
        <>
          <Divider maxWidth="50%" />
          <Stack>
            <Text color="gray.400">{t("common.errors.detailsTitle")}</Text>
            <Text>{description}</Text>
            {isGoogleTranslateUsed && (
              <Text>
                If you are using Google Translate and are facing persistent issues, you may try
                disabling it as there are known issues with it.
              </Text>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
};

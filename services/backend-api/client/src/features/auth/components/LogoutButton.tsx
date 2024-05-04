import { Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { cloneElement, useState } from "react";
import { notifyError } from "@/utils/notifyError";
import { getLogout } from "../api";

interface Props {
  trigger?: React.ReactElement;
}

export const LogoutButton = ({ trigger }: Props) => {
  const { t } = useTranslation();
  const [loggingOut, setLoggingOut] = useState(false);

  const onClickLogout = async () => {
    try {
      setLoggingOut(true);
      await getLogout();
      window.location.assign("https://monitorss.xyz");
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    } finally {
      setLoggingOut(false);
    }
  };

  if (trigger) {
    return cloneElement(trigger, {
      onClick: onClickLogout,
    });
  }

  return (
    <Button
      marginBottom="8"
      justifySelf="flex-end"
      marginTop="4"
      variant="ghost"
      mx="6"
      minHeight="40px"
      isLoading={loggingOut}
      isDisabled={loggingOut}
      onClick={onClickLogout}
    >
      <span>Logout</span>
    </Button>
  );
};

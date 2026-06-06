/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */
import { IconButton, useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FaGear } from "react-icons/fa6";
import { Tag } from "@/components/ui/tag";
import { useDiscordUserMe } from "../../hooks";
import { UserSettingsDialog } from "../UserSettingsDialog";

interface Props {}

export const UserStatusTag: React.FC<Props> = () => {
  const { open, onClose, onOpen } = useDisclosure();
  const { data: userMe } = useDiscordUserMe();
  const { t } = useTranslation();

  return (
    <>
      <UserSettingsDialog isOpen={open} onClose={onClose} />
      {userMe && userMe.supporter && (
        <Tag
          marginTop="4"
          colorPalette="purple"
          size="sm"
          marginRight="0"
          paddingRight={0}
          endElement={
            <IconButton
              size="xs"
              borderLeftRadius={0}
              aria-label="Supporter settings"
              onClick={onOpen}
            >
              <FaGear fontSize="xs" />
            </IconButton>
          }
        >
          {t("components.sidebar.supporterUserTag")}
        </Tag>
      )}
      {userMe && !userMe.supporter && (
        <Tag marginTop="4" size="sm">
          {t("components.sidebar.regularUserTag")}
        </Tag>
      )}
    </>
  );
};

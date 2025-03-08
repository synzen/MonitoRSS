import {
  Alert,
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
  chakra,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaRightFromBracket } from "react-icons/fa6";
import { SettingsIcon, InfoIcon, WarningTwoIcon } from "@chakra-ui/icons";

import { pages } from "../../constants";
import { LogoutButton } from "../../features/auth";

import { useDiscordBot, useDiscordUserMe, useUserMe } from "../../features/discordUser";
import { Loading } from "../Loading";
import { ReportABugDialog } from "../ReportABugDialog";

interface Props {
  invertBackground?: boolean;
}

export const NewHeader = ({ invertBackground }: Props) => {
  const { data: discordBotData, status, error } = useDiscordBot();
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userMe } = useUserMe();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <chakra.header width="full" borderBottom="solid 1px" borderColor="gray.700">
      <Box
        width="100%"
        background={invertBackground ? "gray.700" : "none"}
        display="flex"
        justifyContent="center"
      >
        <Flex
          width="100%"
          justifyContent="space-between"
          maxWidth="1400px"
          paddingX={{ base: 4, lg: 12 }}
        >
          <HStack overflow="hidden" gap={8}>
            <Flex alignItems="center" overflow="hidden">
              {discordBotData && (
                <Link to={pages.userFeeds()} aria-label="MonitoRSS Home">
                  <Flex alignItems="center" paddingBottom="1" overflow="hidden">
                    <Avatar
                      src={discordBotData.result.avatar || undefined}
                      size="sm"
                      name={discordBotData.result.username}
                      marginRight="2"
                      backgroundColor="transparent"
                    />
                    <chakra.span
                      fontSize="xl"
                      whiteSpace="nowrap"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      fontWeight="bold"
                      title="MonitoRSS"
                    >
                      MonitoRSS
                    </chakra.span>
                  </Flex>
                </Link>
              )}
              {status === "loading" && (
                <Box>
                  <Loading />
                </Box>
              )}
              {error && <Alert status="error">{error.message}</Alert>}
            </Flex>
            <HStack>
              {userMe && !userMe?.result.migratedToPersonalFeeds && (
                <Button
                  variant="ghost"
                  colorScheme={pathname === pages.userFeedsFaq() ? "blue" : undefined}
                  onClick={() => navigate(pages.userFeedsFaq())}
                >
                  FAQ
                </Button>
              )}
            </HStack>
          </HStack>
          <Flex alignItems="center" paddingY="4">
            <Menu placement="bottom-end">
              <MenuButton as={Button} size="sm" variant="link" aria-label="Account settings">
                <Avatar
                  src={discordUserMe?.iconUrl}
                  size="sm"
                  name={discordUserMe?.username}
                  backgroundColor="transparent"
                  title={discordUserMe?.username}
                  aria-hidden
                />
              </MenuButton>
              <MenuList>
                <Box overflow="hidden" paddingX={2} title={discordUserMe?.username}>
                  <Text
                    overflow="hidden"
                    maxWidth={300}
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {discordUserMe?.username}
                  </Text>
                  <Text fontSize="sm" color="whiteAlpha.600">
                    Discord ID: {discordUserMe?.id}
                  </Text>
                </Box>
                <MenuDivider />
                <MenuItem icon={<SettingsIcon />} onClick={() => navigate(pages.userSettings())}>
                  Account Settings
                </MenuItem>
                <MenuItem
                  alignItems="center"
                  icon={<InfoIcon />}
                  onClick={() => {
                    window.open("https://support.monitorss.xyz", "_blank");
                  }}
                >
                  Request Support
                </MenuItem>
                <ReportABugDialog
                  trigger={
                    <MenuItem
                      alignItems="center"
                      icon={<WarningTwoIcon />}
                      onClick={() => {
                        window.open("https://support.monitorss.xyz", "_blank");
                      }}
                    >
                      Report a Bug
                    </MenuItem>
                  }
                />
                <LogoutButton
                  trigger={
                    <MenuItem icon={<FaRightFromBracket />}>
                      {t("components.pageContentV2.logout")}
                    </MenuItem>
                  }
                />
              </MenuList>
            </Menu>
          </Flex>
        </Flex>
      </Box>
    </chakra.header>
  );
};

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
import { Link, useNavigate } from "react-router-dom";
import { SettingsIcon, InfoIcon } from "@chakra-ui/icons";

import { pages } from "../../constants";
import { Loading } from "../Loading";

interface Props {
  invertBackground?: boolean;
  bot?: { avatar?: string | null; username: string } | null;
  isBotLoading?: boolean;
  botError?: { message: string } | null;
  user?: { iconUrl?: string; username?: string; id?: string };
  searchSlot?: React.ReactNode;
  logoutSlot?: React.ReactNode;
}

export const NewHeader = ({
  invertBackground,
  bot,
  isBotLoading,
  botError,
  user,
  searchSlot,
  logoutSlot,
}: Props) => {
  const navigate = useNavigate();

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
          <HStack gap={8}>
            <Flex alignItems="center" overflow="hidden">
              {bot && (
                <Link to={pages.userFeeds()} aria-label="MonitoRSS Home">
                  <Flex alignItems="center" paddingBottom="1" overflow="hidden">
                    <Avatar
                      src={bot.avatar || undefined}
                      size="sm"
                      name={bot.username}
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
              {isBotLoading && (
                <Box>
                  <Loading />
                </Box>
              )}
              {botError && <Alert status="error">{botError.message}</Alert>}
            </Flex>
            <HStack>{searchSlot}</HStack>
          </HStack>
          <Flex alignItems="center" paddingY="4">
            <Menu placement="bottom-end">
              <MenuButton as={Button} size="sm" variant="link" aria-label="Account settings">
                <Avatar
                  src={user?.iconUrl}
                  size="sm"
                  name={user?.username}
                  backgroundColor="gray.600"
                  title={user?.username}
                  aria-hidden
                />
              </MenuButton>
              <MenuList>
                <Box overflow="hidden" paddingX={2} title={user?.username}>
                  <Text
                    overflow="hidden"
                    maxWidth={300}
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {user?.username}
                  </Text>
                  <Text fontSize="sm" color="whiteAlpha.600">
                    Discord ID: {user?.id}
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
                    window.open("https://discord.gg/pudv7Rx", "_blank");
                  }}
                >
                  Discord Support Server
                </MenuItem>
                {logoutSlot}
              </MenuList>
            </Menu>
          </Flex>
        </Flex>
      </Box>
    </chakra.header>
  );
};

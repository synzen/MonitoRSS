import {
  Alert,
  Avatar,
  Box,
  Button,
  Flex,
  Heading,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LogoutButton } from '../../features/auth';

import { useDiscordBot, useDiscordUserMe } from '../../features/discordUser';
import { Loading } from '../Loading';

interface Props {
  // eslint-disable-next-line react/no-unused-prop-types
  requireFeed?: boolean
  children?: React.ReactNode;
  invertBackground?: boolean
}

export const PageContentV2 = ({ children, invertBackground }: Props) => {
  const {
    data: discordBotData,
    status,
    error,
  } = useDiscordBot();
  const {
    data: userMe,
  } = useDiscordUserMe();
  const { t } = useTranslation();

  return (
    <Flex
      flexGrow={1}
      height="100%"
      alignItems="center"
      flexDir="column"
      overflowX="auto"
    >
      <Box
        width="100%"
        background={invertBackground ? 'gray.700' : 'none'}
        display="flex"
        justifyContent="center"
      >
        <Flex
          width="100%"
          justifyContent="space-between"
          maxWidth="1400px"
          paddingX={{ base: 4, lg: 12 }}
        >
          <Flex alignItems="center" overflow="hidden">
            {discordBotData && (
            <Flex alignItems="center" paddingBottom="1" overflow="hidden">
              <Avatar
                src={discordBotData.result.avatar || undefined}
                size="sm"
                name={discordBotData.result.username}
                marginRight="2"
                backgroundColor="transparent"
              />
              <Heading
                fontSize="xl"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                title={discordBotData.result.username}
              >
                {discordBotData.result.username}

              </Heading>
            </Flex>
            )}
            {status === 'loading' && <Box><Loading /></Box>}
            {error && <Alert status="error">{error.message}</Alert>}

          </Flex>
          <Flex alignItems="center" paddingY="4">
            <Menu placement="bottom-end">
              <MenuButton as={Button} size="sm" variant="link">
                <Avatar
                  src={userMe?.iconUrl}
                  size="sm"
                  name={userMe?.username}
                  backgroundColor="transparent"
                  title={userMe?.username}
                />
              </MenuButton>
              <MenuList>
                <LogoutButton trigger={(
                  <MenuItem>
                    {t('components.pageContentV2.logout')}
                  </MenuItem>
                  )}
                />
              </MenuList>
            </Menu>
          </Flex>
        </Flex>
      </Box>
      <Flex width="100%" justifyContent="center">
        {children}
      </Flex>
    </Flex>
  );
};

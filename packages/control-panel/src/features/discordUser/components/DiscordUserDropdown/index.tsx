import { ChevronDownIcon } from '@chakra-ui/icons';
import {
  Button, Menu, MenuButton, MenuItem, MenuList, Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useDiscordUserMe } from '../../hooks';

export const DiscordUserDropdown: React.FC = () => {
  const {
    data: userMe,
  } = useDiscordUserMe();
  const { t } = useTranslation();

  return (
    <Menu>
      <MenuButton
        as={Button}
        width="min-content"
        rightIcon={<ChevronDownIcon />}
        variant="ghost"
        marginTop="4"
        marginBottom="4"
        aria-label="User menu"
      >
        <Text textOverflow="ellipsis" overflow="hidden">
          {userMe?.username}
        </Text>
      </MenuButton>
      <MenuList py="2" px="2" shadow="lg">
        <MenuItem rounded="md">
          {t('components.sidebar.userDropdown.logout')}
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

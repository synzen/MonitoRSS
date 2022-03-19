/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */
import {
  HStack,
  IconButton,
  Tag,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { SettingsIcon } from '@chakra-ui/icons';
import { useDiscordUserMe } from '../../hooks';
import { UserSettingsDialog } from '../UserSettingsDialog';

interface Props {
}

export const UserStatusTag: React.FC<Props> = () => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const {
    data: userMe,
  } = useDiscordUserMe();
  const { t } = useTranslation();

  return (
    <>
      <UserSettingsDialog
        isOpen={isOpen}
        onClose={onClose}
      />
      {userMe && userMe.supporter && (
      <Tag
        marginTop="4"
        colorScheme="purple"
        size="sm"
        marginRight="0"
        paddingRight={0}
      >
        <HStack>
          <Text>
            {t('components.sidebar.supporterUserTag')}
          </Text>
          <IconButton
            size="xs"
            borderLeftRadius={0}
            icon={<SettingsIcon fontSize="xs" />}
            aria-label="Supporter settings"
            onClick={onOpen}
          />
        </HStack>
      </Tag>
      )}
      {userMe && !userMe.supporter && (
      <Tag
        marginTop="4"
        size="lg"
      >
        {t('components.sidebar.regularUserTag')}
      </Tag>
      )}
    </>
  );
};

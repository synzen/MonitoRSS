import { DeleteIcon } from '@chakra-ui/icons';
import {
  Button,
  ButtonGroup,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  useDisclosure,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { notifyError } from '../../../../utils/notifyError';
import { notifySuccess } from '../../../../utils/notifySuccess';
import { useFeed } from '../../../feed/hooks';
import { useDeleteConnection } from '../../hooks';

interface Props {
  serverId: string
  feedId: string;
  connectionId: string
}

export const DeleteConnectionButton = ({ serverId, feedId, connectionId }: Props) => {
  const { t } = useTranslation();
  const { mutateAsync } = useDeleteConnection();
  const navigate = useNavigate();
  const { isOpen, onToggle, onClose } = useDisclosure();
  const {
    refetch,
  } = useFeed({ feedId });
  const [isDeleting, setIsDeleting] = useState(false);

  const onDelete = async () => {
    try {
      setIsDeleting(true);
      await mutateAsync({
        feedId,
        connectionId,
      });
      await refetch();
      notifySuccess(t('common.success.deleted'));
      navigate(`/v2/servers/${serverId}/feeds/${feedId}`);
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Popover
      returnFocusOnClose={false}
      isOpen={isOpen}
      onClose={onClose}
      closeOnBlur
    >
      <PopoverTrigger>
        <Button
          variant="outline"
          disabled={isOpen || isDeleting}
          onClick={onToggle}
          leftIcon={<DeleteIcon />}
        >
          {t('common.buttons.delete')}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader
          fontWeight="semibold"
        >
          {t('features.feedConnections.components.deleteButton.confirmTitle')}
        </PopoverHeader>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverBody>
          {t('features.feedConnections.components.deleteButton.confirmDescription')}
        </PopoverBody>
        <PopoverFooter display="flex" justifyContent="flex-end">
          <ButtonGroup size="sm">
            <Button
              variant="outline"
            >
              {t('common.buttons.cancel')}
            </Button>
            <Button
              colorScheme="red"
              onClick={onDelete}
              isLoading={isDeleting}
            >
              {t('common.buttons.delete')}
            </Button>
          </ButtonGroup>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
};

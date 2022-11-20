import { DeleteIcon } from '@chakra-ui/icons';
import {
  Button,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../../../components';
import { FeedConnectionType } from '../../../../types';
import { notifyError } from '../../../../utils/notifyError';
import { notifySuccess } from '../../../../utils/notifySuccess';
import { useDeleteConnection } from '../../hooks';

interface Props {
  feedId: string;
  connectionId: string
  type: FeedConnectionType
}

export const DeleteConnectionButton = ({ feedId, connectionId, type }: Props) => {
  const { t } = useTranslation();
  const { mutateAsync, status } = useDeleteConnection(type);
  const navigate = useNavigate();

  const onDelete = async () => {
    try {
      await mutateAsync({
        feedId,
        connectionId,
      });
      navigate(`/v2/feeds/${feedId}`);
      notifySuccess(t('common.success.deleted'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  return (
    <ConfirmModal
      title={t('features.feedConnections.components.deleteButton.confirmTitle')}
      description={t('features.feedConnections.components.deleteButton.confirmDescription')}
      trigger={(
        <Button
          variant="outline"
          disabled={status === 'loading'}
          leftIcon={<DeleteIcon />}
        >
          {t('common.buttons.delete')}
        </Button>
      )}
      okText={t('pages.userFeed.deleteConfirmOk')}
      okLoading={status === 'loading'}
      colorScheme="red"
      onConfirm={onDelete}
    />

  );
};

import { DeleteIcon } from '@chakra-ui/icons';
import {
  Button,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../../../components';
import { notifyError } from '../../../../utils/notifyError';
import { notifySuccess } from '../../../../utils/notifySuccess';
import { useFeed } from '../../../feed/hooks';
import { useDeleteConnection } from '../../hooks';

interface Props {
  feedId: string;
  connectionId: string
}

export const DeleteConnectionButton = ({ feedId, connectionId }: Props) => {
  const { t } = useTranslation();
  const { mutateAsync, status } = useDeleteConnection();
  const navigate = useNavigate();
  const {
    refetch,
  } = useFeed({ feedId });

  const onDelete = async () => {
    try {
      await mutateAsync({
        feedId,
        connectionId,
      });
      navigate(`/v2/feeds/${feedId}`);
      notifySuccess(t('common.success.deleted'));
      await refetch();
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

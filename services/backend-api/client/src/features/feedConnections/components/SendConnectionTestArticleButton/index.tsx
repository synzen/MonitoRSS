import {
  Button, Tooltip,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { FeedConnectionType, SendTestArticleDeliveryStatus } from '../../../../types';
import { notifyError } from '../../../../utils/notifyError';
import { notifySuccess } from '../../../../utils/notifySuccess';
import { useCreateConnectionTestArticle } from '../../hooks';

interface Props {
  feedId: string;
  connectionId: string
  type: FeedConnectionType
}

export const SendConnectionTestArticleButton = ({
  feedId, connectionId, type,
}: Props) => {
  const { t } = useTranslation();
  const { mutateAsync, status } = useCreateConnectionTestArticle(type);

  const onClick = async () => {
    try {
      const { result } = await mutateAsync({
        feedId,
        connectionId,
      });

      if (result.status === SendTestArticleDeliveryStatus.Success) {
        notifySuccess(t('features.feedConnections.components.'
        + 'sendTestArticleButton.successAlertDescription'));
      } else {
        notifySuccess(t('features.feedConnections.components.'
        + 'sendTestArticleButton.failureAlertDescription'));
      }
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  return (
    <Tooltip label={t('features.feedConnections.components.'
    + 'sendTestArticleButton.description')}
    >
      <Button
        variant="solid"
        colorScheme="blue"
        isLoading={status === 'loading'}
        onClick={onClick}
      >
        {t('features.feedConnections.components.sendTestArticleButton.text')}
      </Button>
    </Tooltip>
  );
};

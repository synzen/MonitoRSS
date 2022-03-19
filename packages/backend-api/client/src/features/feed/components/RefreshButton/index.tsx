import { Button } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { notifyError } from '@/utils/notifyError';
import { refreshFeed } from '../..';
import { notifySuccess } from '@/utils/notifySuccess';

interface Props {
  feedId: string
  onSuccess: () => Promise<any>
}

export const RefreshButton: React.FC<Props> = ({ feedId, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const onRefreshFeed = async () => {
    try {
      setLoading(true);
      await refreshFeed({
        feedId,
      });
      await onSuccess();
      notifySuccess(t('features.feed.components.refreshButton.success'));
    } catch (err) {
      notifyError(t('features.feed.components.refreshButton.faiure'), err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={onRefreshFeed} isLoading={loading}>
      {t('features.feed.components.refreshButton.text')}
    </Button>
  );
};

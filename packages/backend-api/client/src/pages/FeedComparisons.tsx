import {
  FormControl,
  Heading,
  Stack,
  FormLabel,
  FormHelperText,
  Button,
  HStack,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { isEqual } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardContent } from '@/components';
import RouteParams from '../types/RouteParams';
import { useFeed } from '@/features/feed';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useUpdateFeed } from '@/features/feed/hooks/useUpdateFeed';
import { notifyError } from '@/utils/notifyError';
import { AutoResizeTextarea } from '@/components/AutoResizeTextarea';

interface FormState {
  pcomparisons: string
  ncomparisons: string
}

const FeedComparisons: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    status,
    feed,
    error,
  } = useFeed({
    feedId,
  });
  const { mutateAsync } = useUpdateFeed();
  const [formState, setFormState] = useState<FormState>({
    ncomparisons: '',
    pcomparisons: '',
  });
  const [saving, setSaving] = useState(false);

  const formIsDifferent = !isEqual(
    [[...formState.ncomparisons.split('\n').map((s) => s.trim()).filter(Boolean).sort()],
      [...formState.pcomparisons.split('\n').map((s) => s.trim()).filter(Boolean).sort()]],
    [[...feed?.ncomparisons?.sort() || []],
      [...feed?.pcomparisons?.sort() || []]],
  );

  const resetForm = () => {
    if (!feed) {
      return;
    }

    setFormState({
      ncomparisons: feed.ncomparisons.join('\n'),
      pcomparisons: feed.pcomparisons.join('\n'),
    });
  };

  useEffect(() => {
    resetForm();
  }, [feed]);

  if (error) {
    return <ErrorAlert description={error.message} />;
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!feedId) {
      return;
    }

    try {
      setSaving(true);
      const response = await mutateAsync({
        feedId,
        details: {
          ncomparisons: formState.ncomparisons
            .split('\n').map((s) => s.trim()).filter(Boolean).sort(),
          pcomparisons: formState.pcomparisons
            .split('\n').map((s) => s.trim()).filter(Boolean).sort(),
        },
      });

      setFormState({
        ncomparisons: response.result.ncomparisons.join('\n'),
        pcomparisons: response.result.pcomparisons.join('\n'),
      });
    } catch (err) {
      notifyError(t('common.errors.failedToSave'), err as Error);
    } finally {
      setSaving(false);
    }
  };

  const onChangeNcomparisons = (ncomparisonsInput: string) => {
    setFormState({
      ...formState,
      ncomparisons: ncomparisonsInput,
    });
  };

  const onChangePcomparisons = (pcomparisonsInput: string) => {
    setFormState({
      ...formState,
      pcomparisons: pcomparisonsInput,
    });
  };

  return (
    <DashboardContent
      loading={status === 'loading' || status === 'idle'}
    >
      <Stack spacing={8}>
        <Heading>{t('pages.comparisons.title')}</Heading>
        <form onSubmit={onSubmit}>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>
                {t('pages.comparisons.passingComparisonsTitle')}
              </FormLabel>
              <AutoResizeTextarea
                minRows={5}
                value={formState.pcomparisons}
                onChange={(e) => {
                  onChangePcomparisons(e.target.value);
                }}
              />
              <FormHelperText>
                {t('pages.comparisons.passingComparisonsDescription')}
              </FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>
                {t('pages.comparisons.blockingComparisonsTitle')}
              </FormLabel>
              <AutoResizeTextarea
                minRows={5}
                value={formState.ncomparisons}
                onChange={(e) => {
                  onChangeNcomparisons(e.target.value);
                }}
              />
              <FormHelperText>
                {t('pages.comparisons.blockingComparisonsDescription')}
              </FormHelperText>
            </FormControl>

          </Stack>
          <HStack marginTop="4" justifyContent="flex-end">
            <Button
              variant="ghost"
              onClick={resetForm}
              isDisabled={!formIsDifferent || saving}
            >
              {t('pages.comparisons.resetButtonLabel')}
            </Button>
            <Button
              colorScheme="blue"
              isLoading={saving}
              type="submit"
              isDisabled={!formIsDifferent || saving}
            >
              {t('pages.comparisons.saveButtonLabel')}
            </Button>
          </HStack>
        </form>
      </Stack>
    </DashboardContent>
  );
};

export default FeedComparisons;

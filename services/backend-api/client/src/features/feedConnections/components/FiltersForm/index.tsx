import { useState } from 'react';
import { cloneDeep } from 'lodash';
import {
  Button, HStack, Stack,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import {
  FilterExpression,
  FilterExpressionType,
  LogicalExpressionOperator,
  LogicalFilterExpression,
} from '../../types';
import { LogicalExpressionForm } from './LogicalExpressionForm';
import { notifyError } from '../../../../utils/notifyError';

interface Props {
  expression: LogicalFilterExpression
  onSave: (expression: LogicalFilterExpression | null) => Promise<void>
}

export const FiltersForm = ({
  expression,
  onSave,
}: Props) => {
  const { t } = useTranslation();
  const [editingExpression, setEditingExpression] = useState<FilterExpression | null>(
    expression ? cloneDeep(expression) : null,
  );
  const [savingFilters, setSavingFilters] = useState(false);
  const [dirtyForm, setDirtyForm] = useState(false);

  const onExpressionChanged = (newExpression: FilterExpression) => {
    setEditingExpression(newExpression);
    setDirtyForm(true);
  };

  const onDeletedExpression = async () => {
    setEditingExpression(null);
  };

  const onSaveExpression = async () => {
    setSavingFilters(true);

    try {
      await onSave(editingExpression);
      setDirtyForm(false);
    } catch (err) {
      notifyError(
        t('features.feedConnections.components.discordWebhookSettings.filtersUpdateFailed'),
        err as Error,
      );
    } finally {
      setSavingFilters(false);
    }
  };

  if (!editingExpression) {
    return (
      <Stack>
        <Button
          onClick={() => {
            onExpressionChanged({
              type: FilterExpressionType.Logical,
              op: LogicalExpressionOperator.And,
              children: [],
            });
          }}
        >
          {t('features.feedConnections.components.filtersForm.addNewFiltersButtonText')}
        </Button>
        <HStack justifyContent="flex-end">
          <Button
            colorScheme="blue"
            onClick={onSaveExpression}
            isLoading={savingFilters}
            disabled={!dirtyForm || savingFilters}
          >
            {t('features.feedConnections.components.filtersForm.saveButtonText')}
          </Button>
        </HStack>
      </Stack>
    );
  }

  return (
    <Stack>
      <LogicalExpressionForm
        expression={editingExpression}
        onChange={onExpressionChanged}
        onDeleted={onDeletedExpression}
      />
      <HStack justifyContent="flex-end">
        <Button
          colorScheme="blue"
          onClick={onSaveExpression}
          isLoading={savingFilters}
          disabled={!dirtyForm || savingFilters}
        >
          {t('features.feedConnections.components.filtersForm.saveButtonText')}
        </Button>
      </HStack>
    </Stack>
  );
};

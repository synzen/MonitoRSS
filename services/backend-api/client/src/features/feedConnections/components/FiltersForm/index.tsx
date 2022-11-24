import {
  Button, HStack, Stack,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import {
  FormProvider, useForm, useWatch,
} from 'react-hook-form';
import React from 'react';
import {
  FilterExpressionType,
  LogicalExpressionOperator,
  LogicalFilterExpression,
  RelationalExpressionLeftOperandType,
  RelationalExpressionOperator,
  RelationalExpressionRightOperandType,
} from '../../types';
import { LogicalExpressionForm } from './LogicalExpressionForm';

interface FormData {
  expression: LogicalFilterExpression | null
}

interface Props {
  expression?: LogicalFilterExpression | null
  onSave: (expression: LogicalFilterExpression | null) => Promise<void>
}

export const FiltersForm = ({
  expression = null,
  onSave,
}: Props) => {
  const { t } = useTranslation();
  const formMethods = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      expression,
    },
  });
  const {
    handleSubmit,
    control,
    formState: {
      isDirty,
      isSubmitting,
    },
    setValue,
    resetField,
    reset,
  } = formMethods;
  // @ts-ignore cyclical references in typescript types
  const watchedExpression = useWatch({
    control,
    name: 'expression',
  });

  const onClickReset = (e?: React.MouseEvent) => {
    e?.preventDefault();
    resetField('expression');
  };

  const onDeletedExpression = async () => {
    setValue('expression', null, {
      shouldDirty: true,
    });
  };

  const onSaveExpression = async ({ expression: finalExpression }: FormData) => {
    await onSave(finalExpression);
    reset({
      expression: finalExpression,
    });
  };

  const addInitialExpression = () => {
    setValue('expression', {
      type: FilterExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [{
        type: FilterExpressionType.Relational,
        op: RelationalExpressionOperator.Equals,
        left: {
          type: RelationalExpressionLeftOperandType.Article,
          value: '',
        },
        right: {
          type: RelationalExpressionRightOperandType.String,
          value: '',
        },
      }],
    }, {
      shouldDirty: true,
    });
  };

  if (!watchedExpression) {
    return (
      <FormProvider {...formMethods}>
        <form onSubmit={handleSubmit(onSaveExpression)}>
          <Stack>
            <Button
              onClick={addInitialExpression}
            >
              {t('features.feedConnections.components.filtersForm.addNewFiltersButtonText')}
            </Button>
            <HStack justifyContent="flex-end">
              <Button
                colorScheme="blue"
                type="submit"
                isLoading={isSubmitting}
                disabled={!isDirty || isSubmitting}
              >
                {t('common.buttons.save')}
              </Button>
            </HStack>
          </Stack>
        </form>
      </FormProvider>
    );
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSaveExpression)}>
        <Stack>
          <LogicalExpressionForm
            onDeleted={onDeletedExpression}
            prefix="expression."
          />
          <HStack justifyContent="flex-end">
            {isDirty && (
            <Button
              variant="outline"
              onClick={onClickReset}
              type="reset"
            >
              {t('common.buttons.reset')}
            </Button>
            )}
            <Button
              colorScheme="blue"
              isLoading={isSubmitting}
              disabled={!isDirty || isSubmitting}
              type="submit"
            >
              {t('common.buttons.save')}
            </Button>
          </HStack>
        </Stack>
      </form>
    </FormProvider>
  );
};

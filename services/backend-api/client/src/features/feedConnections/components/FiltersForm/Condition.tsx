import {
  CloseButton,
  FormControl, HStack, Select,
} from '@chakra-ui/react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { RelationalExpressionOperator } from '../../types';
import { ConditionInput } from './ConditionInput';

const {
  Equals,
  Contains,
  Matches,
  NotContain,
  NotEqual,
} = RelationalExpressionOperator;

interface Props {
  onDelete: () => void
  prefix?: string
  deletable?: boolean
}

export const Condition = ({
  onDelete,
  prefix = '',
  deletable,
}: Props) => {
  const {
    control,
  } = useFormContext();
  const { t } = useTranslation();

  return (
    <HStack width="100%" alignItems="flex-start">
      <HStack width="100%" spacing={8} alignItems="flex-start">
        <ConditionInput
          controllerName={`${prefix}left.value`}
          placeholder={
            t('features.feedConnections.components.filtersForm.placeholderArticleProperty')
          }
        />
        <FormControl>
          <Controller
            name={`${prefix}op`}
            control={control}
            render={({ field }) => (
              <Select
                flexShrink={1}
                {...field}
              >
                <option
                  value={Equals}
                >
                  {t('features.feedConnections.components.filtersForm.relationalOpEquals')}
                </option>
                <option
                  value={NotEqual}
                >
                  {t('features.feedConnections.components.filtersForm.relationalOpNotEqual')}
                </option>
                <option
                  value={Contains}
                >
                  {t('features.feedConnections.components.filtersForm.relationalOpContains')}
                </option>
                <option
                  value={NotContain}
                >
                  {t('features.feedConnections.components.filtersForm.relationalOpDoesNotContain')}
                </option>
                <option
                  value={Matches}
                >
                  {t('features.feedConnections.components.filtersForm.relationalOpMatches')}
                </option>
              </Select>
            )}
          />
        </FormControl>
        <ConditionInput
          controllerName={`${prefix}right.value`}
          placeholder={
            t('features.feedConnections.components.filtersForm.placeholderArticleValue')
          }
        />
      </HStack>
      {deletable && (
      <CloseButton
        aria-label="Delete condition"
        size="sm"
        onClick={onDelete}
      />
      )}
    </HStack>
  );
};

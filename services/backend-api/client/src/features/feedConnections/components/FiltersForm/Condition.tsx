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
                  value={Contains}
                >
                  {t('features.feedConnections.components.filtersForm.relationalOpContains')}

                </option>
              </Select>
            )}
          />
        </FormControl>
        <ConditionInput
          controllerName={`${prefix}right.value`}
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

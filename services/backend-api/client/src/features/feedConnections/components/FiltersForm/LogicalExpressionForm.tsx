import { ChevronDownIcon } from '@chakra-ui/icons';
import {
  Box, Button, CloseButton, Flex, Menu, MenuButton, MenuItem, MenuList, Stack, Text,
} from '@chakra-ui/react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  FilterExpression,
  FilterExpressionType,
  LogicalExpressionOperator,
  LogicalFilterExpression,
  RelationalExpressionOperator,
} from '../../types';
import { AnyAllSelector } from './AnyAllSelector';
import { Condition } from './Condition';

interface Props {
  onDeleted: () => void
  prefix?: string
}

export const LogicalExpressionForm = ({
  onDeleted,
  prefix = '',
}: Props) => {
  const {
    control,
    setValue,
  } = useFormContext();
  const {
    fields,
    append,
    remove,
    insert,
  } = useFieldArray({
    control,
    name: `${prefix}children`,
  });
  const operator: LogicalExpressionOperator = useWatch({
    control,
    name: `${prefix}op`,
  });

  const { t } = useTranslation();

  const onAnyAllChange = (value: LogicalFilterExpression['op']) => {
    setValue(`${prefix}op`, value, {
      shouldDirty: true,
    });
  };

  const onChildDeleted = (index: number) => {
    remove(index);
  };

  const onAddRelational = () => {
    const indexOfLastRelational = (fields as Array<(FilterExpression & {
      id: string
    })>)?.findIndex((child) => child?.type === FilterExpressionType.Relational) || -1;

    insert(indexOfLastRelational + 1, {
      type: FilterExpressionType.Relational,
      op: RelationalExpressionOperator.Equals,
      left: '',
      right: '',
    });
  };

  const onAddLogical = () => {
    append({
      type: FilterExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [{
        type: FilterExpressionType.Relational,
        op: RelationalExpressionOperator.Equals,
        left: '',
        right: '',
      }],
    });
  };

  const numberOfRelational = (fields as Array<(FilterExpression & {
    id: string
  })>)?.filter((child) => child?.type === FilterExpressionType.Relational).length || 0;

  return (
    <Stack>
      <Box
        border="solid"
        borderWidth="1px"
        borderColor="gray.600"
        padding="4"
        borderRadius="md"
        width="100%"
      >
        <Flex justifyContent="space-between">
          <Box width="100%">
            <Text display="inline" paddingRight={2}>
              When
            </Text>
            <AnyAllSelector
              value={operator}
              onChange={onAnyAllChange}
            />
            <Text display="inline" paddingLeft={2} paddingBottom={4}>
              of the conditions match:
            </Text>
          </Box>
          <CloseButton
            aria-label="Delete condition group"
            onClick={onDeleted}
          />
        </Flex>
        <Stack>
          <Stack spacing={2} marginTop={4} width="100%">
            {(fields as Array<FilterExpression & { id: string }>)?.map((child, childIndex) => {
              if (child?.type === FilterExpressionType.Logical) {
                return (
                  <LogicalExpressionForm
                    key={child.id}
                    onDeleted={() => onChildDeleted(childIndex)}
                    prefix={`${prefix}children.${childIndex}.`}
                  />
                );
              }

              if (child?.type === FilterExpressionType.Relational) {
                return (
                  <Condition
                    key={child.id}
                    onDelete={() => onChildDeleted(childIndex)}
                    prefix={`${prefix}children.${childIndex}.`}
                    deletable={numberOfRelational > 1}
                  />
                );
              }

              return null;
            })}
          </Stack>
          <Box>
            <Menu>
              <MenuButton
                as={Button}
                rightIcon={<ChevronDownIcon />}
                variant="ghost"
              >
                {t('features.feedConnections.components.filtersForm.addButtonText')}

              </MenuButton>
              <MenuList>
                <MenuItem
                  onClick={onAddRelational}
                >
                  {t('features.feedConnections.components.filtersForm.addRelationalButtonText')}

                </MenuItem>
                <MenuItem
                  onClick={onAddLogical}
                >
                  {t('features.feedConnections.components.filtersForm.addLogicalButtonText')}

                </MenuItem>
              </MenuList>
            </Menu>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};

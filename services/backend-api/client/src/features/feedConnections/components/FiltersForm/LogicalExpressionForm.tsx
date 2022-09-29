import { ChevronDownIcon } from '@chakra-ui/icons';
import {
  Box, Button, CloseButton, Flex, Menu, MenuButton, MenuItem, MenuList, Stack, Text,
} from '@chakra-ui/react';
import {
  FilterExpressionType,
  LogicalExpressionOperator,
  LogicalFilterExpression,
  RelationalExpressionOperator,
} from '../../types';
import { AnyAllSelector } from './AnyAllSelector';
import { Condition } from './Condition';

interface Props {
  expression: LogicalFilterExpression
  onChange: (expression: LogicalFilterExpression) => void
  onDeleted: () => void
}

export const LogicalExpressionForm = ({
  expression,
  onChange,
  onDeleted,
}: Props) => {
  const onAnyAllChange = (value: LogicalFilterExpression['op']) => {
    onChange({
      type: FilterExpressionType.Logical,
      op: value,
      children: expression.children,
    });
  };

  const onLogicalChildChanged = (
    index: number,
    child: LogicalFilterExpression['children'][number],
  ) => {
    const newChildren = [...expression.children];
    newChildren[index] = child;
    onChange({
      type: FilterExpressionType.Logical,
      op: expression.op,
      children: newChildren,
    });
  };

  const onChildDeleted = (index: number) => {
    const newChildren = [...expression.children];
    newChildren.splice(index, 1);
    onChange({
      type: FilterExpressionType.Logical,
      op: expression.op,
      children: newChildren,
    });
  };

  const onAddCondition = () => {
    const newChildren = [...expression.children];
    newChildren.push({
      type: FilterExpressionType.Relational,
      left: '',
      op: RelationalExpressionOperator.Equals,
      right: '',
    });
    onChange({
      type: FilterExpressionType.Logical,
      op: expression.op,
      children: newChildren
        .sort((child) => (child.type === FilterExpressionType.Relational ? -1 : 1)),
    });
  };

  const onAddGroup = () => {
    const newChildren = [...expression.children];
    newChildren.push({
      type: FilterExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [],
    });
    onChange({
      type: FilterExpressionType.Logical,
      op: expression.op,
      children: newChildren
        .sort((child) => (child.type === FilterExpressionType.Relational ? -1 : 1)),
    });
  };

  const onRelationalChildChanged = (
    index: number,
    {
      leftValue,
      opValue,
      rightValue,
    }: {
      leftValue?: string,
      opValue: RelationalExpressionOperator,
      rightValue?: string
    },
  ) => {
    const newChildren = [...expression.children];
    newChildren[index] = {
      type: FilterExpressionType.Relational,
      left: leftValue as string,
      op: opValue,
      right: rightValue as string,
    };
    onChange({
      type: FilterExpressionType.Logical,
      op: expression.op,
      children: newChildren,
    });
  };

  return (
    <Box
      border="solid"
      borderWidth="1px"
      borderColor={expression.children.length === 0 ? 'red.500' : 'gray.600'}
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
            value={expression.op}
            onChange={onAnyAllChange}
          />
          <Text display="inline" paddingLeft={2} paddingBottom={4}>
            of the conditions match:
          </Text>
        </Box>
        <CloseButton onClick={onDeleted} />
      </Flex>
      <Stack>
        <Stack spacing={2} marginTop={4} width="100%">
          {expression.children.map((child, childIndex) => {
            if (child.type === FilterExpressionType.Logical) {
              return (
                <LogicalExpressionForm
                  expression={child}
                  onChange={(newExpression) => onLogicalChildChanged(childIndex, newExpression)}
                  onDeleted={() => onChildDeleted(childIndex)}
                />
              );
            }

            const {
              left, op, right,
            } = child;

            return (
              <Condition
                values={{
                  leftValue: left,
                  operator: op,
                  rightValue: right,
                }}
                onChange={({
                  leftValue,
                  operator,
                  rightValue,
                }) => onRelationalChildChanged(childIndex, {
                  leftValue,
                  opValue: operator,
                  rightValue,
                })}
                onDelete={() => onChildDeleted(childIndex)}
              />
            );
          })}
        </Stack>
        <Box>
          <Menu>
            <MenuButton
              as={Button}
              rightIcon={<ChevronDownIcon />}
              variant="ghost"
            >
              Add expression

            </MenuButton>
            <MenuList>
              <MenuItem onClick={onAddCondition}>Add relational</MenuItem>
              <MenuItem onClick={onAddGroup}>Add logical</MenuItem>
            </MenuList>
          </Menu>
        </Box>
      </Stack>
    </Box>
  );
};

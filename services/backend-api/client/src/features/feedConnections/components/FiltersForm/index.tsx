import {
  Box,
  Button,
  Flex,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import {
  FilterExpression,
  FilterExpressionType,
  LogicalExpressionOperator,
  LogicalFilterExpression,
  RelationalExpressionOperator,
  RelationalFilterExpression,
} from '../../types';
import { AnyAllSelector } from './AnyAllSelector';
import { Condition } from './Condition';

const expression: FilterExpression = {
  type: FilterExpressionType.Logical,
  op: LogicalExpressionOperator.And,
  // Everything in children is customizable
  children: [{
    type: FilterExpressionType.Logical,
    op: LogicalExpressionOperator.And,
    // Each relational field is a input row
    children: [{
      type: FilterExpressionType.Relational,
      left: 'title',
      op: RelationalExpressionOperator.Contains,
      right: 'test',
    }, {
      type: FilterExpressionType.Relational,
      left: 'description',
      op: RelationalExpressionOperator.Equals,
      right: 'myvalue',
    }],
  }, {
    type: FilterExpressionType.Logical,
    op: LogicalExpressionOperator.And,
    // Each relational field is a input row
    children: [{
      type: FilterExpressionType.Relational,
      left: 'title',
      op: RelationalExpressionOperator.Contains,
      right: 'test',
    }, {
      type: FilterExpressionType.Relational,
      left: 'description',
      op: RelationalExpressionOperator.Equals,
      right: 'myvalue',
    }],
  }],
};

export const FiltersForm = () => (
  <Stack
    spacing={8}
    alignItems="center"
    width="100%"
    divider={<Box>AND</Box>}
  >
    {expression.children.map((childUntyped) => {
      const child = childUntyped as LogicalFilterExpression;

      return (
        <Stack
          spacing={4}
          border="solid"
          borderWidth={1}
          borderColor="gray.700"
          padding="4"
          width="100%"
        >
          <HStack justifyContent="space-between">
            <Box>
              <Text display="inline" paddingRight={2}>
                When
              </Text>
              <AnyAllSelector
                value={child.op}
                onChange={console.log}
              />
              <Text display="inline" paddingLeft={2}>
                of the conditions match:
              </Text>
            </Box>
            <Button>Remove stage</Button>
          </HStack>
          <Stack spacing={2}>
            {child.children.map((condition) => {
              const {
                left, op, right,
              } = condition as RelationalFilterExpression;

              return (
                <Condition
                  values={{
                    leftValue: left,
                    operator: op,
                    rightValue: right,
                  }}
                  onChange={console.log}
                />
              );
            })}
          </Stack>
          <Flex justifyContent="center">
            <Button>Add condition</Button>
          </Flex>
        </Stack>
      );
    })}
    <Button>Add stage</Button>
  </Stack>
);

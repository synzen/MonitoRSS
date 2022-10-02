import { LogicalExpressionOperator, RelationalExpressionOperator } from './ExpressionOperator';

export enum FilterExpressionType {
  Logical = 'Logical',
  Relational = 'Relational',
}

export interface RelationalFilterExpression {
  type: FilterExpressionType.Relational;
  left: string;
  op: RelationalExpressionOperator;
  right: string;
}

export interface LogicalFilterExpression {
  type: FilterExpressionType.Logical
  op: LogicalExpressionOperator
  children: (RelationalFilterExpression | LogicalFilterExpression)[]
}

export type FilterExpression = LogicalFilterExpression | RelationalFilterExpression;

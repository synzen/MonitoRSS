import {
  LogicalExpressionOperator,
  RelationalExpressionLeftOperandType,
  RelationalExpressionOperator,
  RelationalExpressionRightOperandType,
} from "./ExpressionOperator";

export enum FilterExpressionType {
  Logical = "LOGICAL",
  Relational = "RELATIONAL",
}

export interface RelationalFilterExpression {
  type: FilterExpressionType.Relational;
  left: {
    type: RelationalExpressionLeftOperandType;
    value: string;
  };
  op: RelationalExpressionOperator;
  right: {
    type: RelationalExpressionRightOperandType;
    value: string;
  };
}

export interface LogicalFilterExpression {
  type: FilterExpressionType.Logical;
  op: LogicalExpressionOperator;
  children: (RelationalFilterExpression | LogicalFilterExpression)[];
}

export type FilterExpression = LogicalFilterExpression | RelationalFilterExpression;

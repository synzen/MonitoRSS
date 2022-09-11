export enum ExpressionType {
  Relational = "relational",
  Logical = "logical",
}

export enum RelationalExpressionOperator {
  Eq = "eq",
  Contains = "contains",
}

export enum LogicalExpressionOperator {
  And = "and",
  Or = "or",
  Not = "not",
}

export interface FilterRelationalExpression {
  type: ExpressionType.Relational;
  op: RelationalExpressionOperator;
  left: string;
  right: string;
}

export interface FilterLogicalExpression {
  type: ExpressionType.Logical;
  op: LogicalExpressionOperator;
  children: (FilterRelationalExpression | FilterRelationalExpression)[];
}

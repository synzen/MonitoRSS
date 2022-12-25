import { ExpressionType } from "./expression-type.type";
import { LogicalExpressionOperator } from "./logical-expression-operator.type";
import { RelationalExpression } from "./relational-expression.type";

export interface LogicalExpression {
  type: ExpressionType.Logical;
  op: LogicalExpressionOperator;
  children: (LogicalExpression | RelationalExpression)[];
}

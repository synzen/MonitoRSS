import { ExpressionType } from "./expression-type.type";
import { RelationalExpressionLeft } from "./relational-expression-left.type";
import { RelationalExpressionOperator } from "./relational-expression-operator.type";
import { RelationalExpressionRight } from "./relational-expression-right.type";

export interface RelationalStringExpression {
  type: ExpressionType.Relational;
  op:
    | RelationalExpressionOperator.Eq
    | RelationalExpressionOperator.Contains
    | RelationalExpressionOperator.Matches;
  not?: boolean;
  left: {
    type: RelationalExpressionLeft;
    value: string;
  };
  right: {
    type: RelationalExpressionRight.String;
    value: string;
  };
}

export type RelationalExpression = RelationalStringExpression;

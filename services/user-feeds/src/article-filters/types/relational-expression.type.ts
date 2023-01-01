import { ExpressionType } from "./expression-type.type";
import { RelationalExpressionLeft } from "./relational-expression-left.type";
import { RelationalExpressionOperator } from "./relational-expression-operator.type";
import { RelationalExpressionRight } from "./relational-expression-right.type";

export interface RelationalStringExpression {
  type: ExpressionType.Relational;
  op:
    | RelationalExpressionOperator.Eq
    | RelationalExpressionOperator.NotEq
    | RelationalExpressionOperator.Contains
    | RelationalExpressionOperator.NotContain
    | RelationalExpressionOperator.Matches;
  left: {
    type: RelationalExpressionLeft;
    value: string;
  };
  right: {
    type: RelationalExpressionRight.String;
    value: string;
  };
}

// export interface RelationalRegExpExpression {
//   type: ExpressionType.Relational;
//   op: RelationalExpressionOperator.Matches;
//   left: {
//     type: RelationalExpressionLeft;
//     value: string;
//   };
//   right: {
//     type: RelationalExpressionRight.RegExp;
//     value: string;
//   };
// }

export type RelationalExpression = RelationalStringExpression;

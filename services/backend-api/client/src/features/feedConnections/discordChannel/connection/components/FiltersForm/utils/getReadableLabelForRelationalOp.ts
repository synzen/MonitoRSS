import { RelationalExpressionOperator } from "../../../types";

export const getReadableLabelForRelationalOp = (op: RelationalExpressionOperator) => {
  switch (op) {
    case RelationalExpressionOperator.Contains:
      return "contain";
    case RelationalExpressionOperator.Equals:
      return "equal";
    case RelationalExpressionOperator.Matches:
      return "regex match";
    case RelationalExpressionOperator.NotContain:
      return "does not contain";
    default:
      return op;
  }
};

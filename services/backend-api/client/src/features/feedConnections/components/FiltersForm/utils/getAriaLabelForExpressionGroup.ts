import { LogicalExpressionOperator } from "../../../types";

export const getAriaLabelForExpressionGroup = (op: LogicalExpressionOperator) => {
  return `Condition group where ${
    op === LogicalExpressionOperator.And ? "all" : "any"
  } of the conditions must match`;
};

import { RelationalExpressionOperator, RelationalFilterExpression } from "../../../types";
import { getReadableLabelForRelationalOp } from "./getReadableLabelForRelationalOp";

export const getAriaLabelForExpression = ({ left, op, right, not }: RelationalFilterExpression) => {
  const isIncomplete = !left.value || !right.value || !op;

  if (isIncomplete) {
    return "Condition expression with incomplete form fields";
  }

  let opLabel = getReadableLabelForRelationalOp(op);

  return `Condition expression where ${left.value} ${not ? "does not" : "does"} ${opLabel} ${
    right.value
  }`;
};

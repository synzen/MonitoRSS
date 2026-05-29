import { RelationalFilterExpression } from "../../../types";
import { getReadableLabelForRelationalOp } from "./getReadableLabelForRelationalOp";

export const getAriaLabelForExpression = ({ left, op, right, not }: RelationalFilterExpression) => {
  const isIncomplete = !left.value || !right.value || !op;

  if (isIncomplete) {
    return "Condition expression with incomplete form fields. Press tab to edit condition fields.";
  }

  const opLabel = getReadableLabelForRelationalOp(op);

  return `Condition expression where ${left.value} ${not ? "does not" : "does"} ${opLabel} ${
    right.value
  }. Press tab to edit condition fields.`;
};

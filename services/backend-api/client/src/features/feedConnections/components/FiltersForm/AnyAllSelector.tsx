import { Button, ButtonGroup } from "@chakra-ui/react";
import { LogicalExpressionOperator } from "../../types";

const { And, Or } = LogicalExpressionOperator;

interface Props {
  value?: LogicalExpressionOperator;
  onChange: (value: LogicalExpressionOperator) => void;
}

export const AnyAllSelector = ({ value, onChange }: Props) => {
  const onSelectAnd = () => {
    onChange(And);
  };

  const onSelectOr = () => {
    onChange(Or);
  };

  return (
    <ButtonGroup size="sm" isAttached variant="outline" aria-label="Any or all condition selector">
      <Button
        onClick={onSelectAnd}
        colorScheme={value === And ? "blue" : undefined}
        variant={value === And ? "solid" : "outline"}
      >
        ALL
      </Button>
      <Button
        onClick={onSelectOr}
        colorScheme={value === Or ? "blue" : undefined}
        variant={value === Or ? "solid" : "outline"}
      >
        ANY
      </Button>
    </ButtonGroup>
  );
};

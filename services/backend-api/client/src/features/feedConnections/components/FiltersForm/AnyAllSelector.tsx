import { Button, ButtonGroup } from "@chakra-ui/react";
import { LogicalExpressionOperator } from "../../types";
import { useNavigableTreeItemContext } from "../../../../contexts/NavigableTreeItemContext";

const { And, Or } = LogicalExpressionOperator;

interface Props {
  value?: LogicalExpressionOperator;
  onChange: (value: LogicalExpressionOperator) => void;
}

export const AnyAllSelector = ({ value, onChange }: Props) => {
  const { isFocused } = useNavigableTreeItemContext();

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
        aria-label="All conditions must match"
        tabIndex={isFocused ? 0 : -1}
      >
        ALL
      </Button>
      <Button
        onClick={onSelectOr}
        colorScheme={value === Or ? "blue" : undefined}
        variant={value === Or ? "solid" : "outline"}
        aria-label="Any condition can match"
        tabIndex={isFocused ? 0 : -1}
      >
        ANY
      </Button>
    </ButtonGroup>
  );
};

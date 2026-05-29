import { chakra, Text } from "@chakra-ui/react";

export const CssSelectorFormattedOption = ({
  label,
  description,
  isSelected,
}: {
  label: string;
  description?: string;
  isSelected: boolean;
}) => {
  return (
    <div>
      <chakra.span fontFamily="mono">{label}</chakra.span>
      {!isSelected && (
        <chakra.span>
          <br />
          <Text color="whiteAlpha.700">{description}</Text>
        </chakra.span>
      )}
    </div>
  );
};

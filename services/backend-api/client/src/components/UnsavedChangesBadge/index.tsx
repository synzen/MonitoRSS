import { Highlight, Text } from "@chakra-ui/react";

interface Props {
  label?: string;
}

export const UnsavedChangesBadge = ({ label = "Unsaved changes" }: Props) => {
  return (
    <Text fontSize="sm" fontWeight={600}>
      <Highlight
        query={label}
        styles={{
          bg: "orange.subtle",
          color: "orange.fg",
          rounded: "full",
          px: "2",
          py: "1",
        }}
      >
        {label}
      </Highlight>
    </Text>
  );
};

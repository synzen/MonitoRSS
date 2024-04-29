import { chakra, Text } from "@chakra-ui/react";

export const CssSelectorFormattedOption = ({
  label,
  isSelected,
}: {
  label: string;
  isSelected: boolean;
}) => {
  let description = "";

  switch (label) {
    case "img":
      description = "Targets all images on the page.";
      break;
    case "a":
      description = "Targets all links on the page.";
      break;
    case 'meta[property="og:image"]':
      description = "Targets the image used when sharing the page on social media.";
      break;
    default:
      break;
  }

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

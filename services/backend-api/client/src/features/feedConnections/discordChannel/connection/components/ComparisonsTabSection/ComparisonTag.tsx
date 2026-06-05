import { Spinner, Tag as ChakraTag } from "@chakra-ui/react";
import { useState } from "react";

interface Props {
  colorScheme: string;
  title: string;
  onDelete: () => Promise<void>;
  deleteButtonAriaLabel?: string;
}

export const ComparisonTag = ({ colorScheme, title, onDelete, deleteButtonAriaLabel }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const onClickDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  };

  return (
    <ChakraTag.Root size="lg" colorPalette={colorScheme} margin={0} asChild>
      <li>
        <ChakraTag.Label>{title}</ChakraTag.Label>
        {isDeleting && (
          <ChakraTag.EndElement>
            <Spinner size="xs" />
          </ChakraTag.EndElement>
        )}
        {!isDeleting && (
          <ChakraTag.EndElement>
            <ChakraTag.CloseTrigger
              aria-label={deleteButtonAriaLabel}
              onClick={() => onClickDelete()}
            />
          </ChakraTag.EndElement>
        )}
      </li>
    </ChakraTag.Root>
  );
};

import { Spinner, Tag, TagCloseButton, TagLabel, TagRightIcon } from "@chakra-ui/react";
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
    <Tag size="lg" colorScheme={colorScheme} margin={0} as="li">
      <TagLabel>{title}</TagLabel>
      {isDeleting && <TagRightIcon as={Spinner} />}
      {!isDeleting && (
        <TagCloseButton aria-label={deleteButtonAriaLabel} onClick={() => onClickDelete()} />
      )}
    </Tag>
  );
};

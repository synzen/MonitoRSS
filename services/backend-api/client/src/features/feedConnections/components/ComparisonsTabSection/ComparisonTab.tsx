import { Spinner, Tag, TagCloseButton, TagLabel, TagRightIcon } from "@chakra-ui/react";
import { useState } from "react";

interface Props {
  colorScheme: string;
  title: string;
  onDelete: () => Promise<void>;
}

export const ComparisonTab = ({ colorScheme, title, onDelete }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const onClickDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  };

  return (
    <Tag size="lg" colorScheme={colorScheme}>
      <TagLabel>{title}</TagLabel>
      {isDeleting && <TagRightIcon as={Spinner} />}
      {!isDeleting && <TagCloseButton aria-label="Delete" onClick={() => onClickDelete()} />}
    </Tag>
  );
};

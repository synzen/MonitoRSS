import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from "@chakra-ui/react";
import { ReactNode, useEffect, useRef } from "react";

interface Props {
  title?: string;
  description?: string | ReactNode;
  scrollIntoViewOnMount?: boolean;
  hideIcon?: boolean;
}

export const InlineErrorAlert = ({
  title,
  description,
  scrollIntoViewOnMount,
  hideIcon,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && scrollIntoViewOnMount) {
      ref.current.scrollIntoView({ behavior: "smooth", inline: "start" });
    }
  }, [ref.current, scrollIntoViewOnMount]);

  return (
    <Alert status="error" ref={ref}>
      {!hideIcon && <AlertIcon />}
      <Box>
        <AlertTitle display="block">{title}</AlertTitle>
        <AlertDescription display="block">{description}</AlertDescription>
      </Box>
    </Alert>
  );
};

interface IncompleteFormProps {
  fieldCount: number;
}

export const InlineErrorIncompleteFormAlert = ({ fieldCount }: IncompleteFormProps) => {
  return (
    <InlineErrorAlert
      title="Failed to save changes"
      description={`${fieldCount} fields have invalid values`}
    />
  );
};

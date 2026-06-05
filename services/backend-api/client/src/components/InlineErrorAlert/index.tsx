import { Alert } from "@chakra-ui/react";
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
    <Alert.Root role="alert" status="error" ref={ref}>
      {!hideIcon && <Alert.Indicator />}
      <Alert.Content>
        <Alert.Title display="block">{title}</Alert.Title>
        <Alert.Description display="block">{description}</Alert.Description>
      </Alert.Content>
    </Alert.Root>
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

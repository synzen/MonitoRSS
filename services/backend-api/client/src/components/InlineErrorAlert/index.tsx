import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

interface Props {
  title?: string;
  description?: string;
  scrollIntoViewOnMount?: boolean;
}

export const InlineErrorAlert = ({ title, description, scrollIntoViewOnMount }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && scrollIntoViewOnMount) {
      ref.current.scrollIntoView({ behavior: "smooth", inline: "start" });
    }
  }, [ref.current, scrollIntoViewOnMount]);

  return (
    <Alert status="error" ref={ref}>
      <AlertIcon />
      <Box>
        <AlertTitle display="block">{title}</AlertTitle>
        <AlertDescription display="block">{description}</AlertDescription>
      </Box>
    </Alert>
  );
};

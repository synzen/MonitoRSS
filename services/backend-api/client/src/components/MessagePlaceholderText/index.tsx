import { Button, chakra, Code, Flex } from "@chakra-ui/react";
import { PropsWithChildren } from "react";
import { notifyInfo } from "../../utils/notifyInfo";

interface Props {
  withBrackets?: boolean;
  withoutCopy?: boolean;
}

const MessagePlaceholderText = ({
  children,
  withBrackets,
  withoutCopy,
}: PropsWithChildren<Props>) => {
  const onCopy = () => {
    if (typeof children === "string") {
      navigator.clipboard.writeText(children);
    }

    notifyInfo("Successfully copied to clipboard");
  };

  return (
    <Flex alignItems="center" display="inline">
      <Code>
        {withBrackets && <chakra.span srOnly>double open curly brackets</chakra.span>}
        {withBrackets && <chakra.span aria-hidden>{"{{"}</chakra.span>}
        {children}
        {withBrackets && <chakra.span aria-hidden>{"}}"}</chakra.span>}
        {withBrackets && <chakra.span srOnly>double close curly brackets</chakra.span>}
      </Code>
      {!withoutCopy && (
        <Button srOnly size="xs" variant="ghost" colorScheme="gray" marginLeft="2" onClick={onCopy}>
          Click to copy this placeholder
        </Button>
      )}
    </Flex>
  );
};

export default MessagePlaceholderText;

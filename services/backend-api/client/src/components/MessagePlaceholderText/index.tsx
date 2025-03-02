import { chakra, Code, Flex, IconButton } from "@chakra-ui/react";
import { PropsWithChildren } from "react";
import { CopyIcon } from "@chakra-ui/icons";
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
      navigator.clipboard.writeText(`{{${children}}}`);
    }

    notifyInfo("Successfully copied placeholder to clipboard");
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
        <IconButton
          ml={1}
          icon={<CopyIcon />}
          variant="outline"
          aria-label="Copy this placeholder"
          onClick={onCopy}
          size="xs"
        />
      )}
    </Flex>
  );
};

export default MessagePlaceholderText;

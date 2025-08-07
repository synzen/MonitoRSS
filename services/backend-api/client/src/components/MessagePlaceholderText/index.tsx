import { chakra, Code, Flex, IconButton } from "@chakra-ui/react";
import { PropsWithChildren } from "react";
import { CopyIcon } from "@chakra-ui/icons";
import { notifyInfo } from "../../utils/notifyInfo";
import { notifyError } from "../../utils/notifyError";

interface Props {
  withBrackets?: boolean;
  withoutCopy?: boolean;
}

const unsecuredCopyToClipboard = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  document.execCommand("copy");
  document.body.removeChild(textArea);
};

const MessagePlaceholderText = ({
  children,
  withBrackets,
  withoutCopy,
}: PropsWithChildren<Props>) => {
  const onCopy = () => {
    try {
      if (typeof children === "string") {
        const textToCopy = `{{${children}}}`;

        if (window.isSecureContext && navigator.clipboard) {
          navigator.clipboard.writeText(textToCopy);
        } else {
          unsecuredCopyToClipboard(textToCopy);
        }
      }

      notifyInfo("Successfully copied placeholder to clipboard");
    } catch (err) {
      console.error(`Failed to copy to clipboard: ${(err as Error).message}`);
      notifyError(`Failed to copy placeholder to clipboard`, err as Error);
    }
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

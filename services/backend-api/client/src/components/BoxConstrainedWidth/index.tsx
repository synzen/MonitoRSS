import { Stack, StackProps } from "@chakra-ui/react";

// Shared container metrics: the header and legal footer must align their content
// with page content, so they reuse these instead of restating the values.
export const BOX_CONSTRAINED_MAX_WIDTH = "1400px";
export const BOX_CONSTRAINED_PADDING_X: StackProps["paddingX"] = [4, 4, 4, 6, 12];

interface BoxConstrainedWidthWrapperProps extends StackProps {
  children?: React.ReactNode;
}

const BoxConstrainedWidthWrapper = ({ children, ...props }: BoxConstrainedWidthWrapperProps) => (
  <Stack width="100%" justifyContent="center" overflow="auto" alignItems="center" {...props}>
    {children}
  </Stack>
);

interface BoxConstrainedWidthContainerProps extends StackProps {
  children?: React.ReactNode;
}

const BoxConstrainedWidthContainer = ({
  children,
  ...props
}: BoxConstrainedWidthContainerProps) => (
  <Stack
    maxWidth={BOX_CONSTRAINED_MAX_WIDTH}
    width="100%"
    paddingX={BOX_CONSTRAINED_PADDING_X}
    {...props}
  >
    {children}
  </Stack>
);

export const BoxConstrained = {
  Wrapper: BoxConstrainedWidthWrapper,
  Container: BoxConstrainedWidthContainer,
};

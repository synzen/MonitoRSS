import { Stack, StackProps } from "@chakra-ui/react";

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
  <Stack maxWidth="1400px" width="100%" paddingX={[4, 4, 8, 12]} {...props}>
    {children}
  </Stack>
);

export const BoxConstrained = {
  Wrapper: BoxConstrainedWidthWrapper,
  Container: BoxConstrainedWidthContainer,
};

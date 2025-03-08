// 1. import `extendTheme` function
import { AlertProps, extendTheme, ThemeConfig } from "@chakra-ui/react";
import { formAnatomy } from "@chakra-ui/anatomy";
import type { PartsStyleFunction, SystemStyleFunction } from "@chakra-ui/theme-tools";
import { mode } from "@chakra-ui/theme-tools";

// 2. Add your color mode config
const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

// 3. extend the theme

const baseStyleRequiredIndicator: SystemStyleFunction = (props) => {
  return {
    marginStart: 1,
    color: mode("red.500", "red.300")(props),
  };
};

const baseStyleHelperText: SystemStyleFunction = (props) => {
  return {
    mt: 2,
    color: mode("gray.500", "whiteAlpha.700")(props),
    lineHeight: "normal",
    fontSize: "sm",
  };
};

const formBaseStyle: PartsStyleFunction<typeof formAnatomy> = (props) => ({
  container: { width: "100%", position: "relative" },
  requiredIndicator: baseStyleRequiredIndicator(props),
  helperText: baseStyleHelperText(props),
});

const theme = extendTheme({
  config,
  components: {
    Alert: {
      baseStyle: (props: AlertProps) => {
        if (props.variant === "solid") {
          return undefined;
        }

        let backgroundColor;

        if (props.status === "error") {
          backgroundColor = "red.800";
        } else if (props.status === "success") {
          backgroundColor = "green.700";
        } else if (props.status === "warning") {
          backgroundColor = "yellow.900";
        } else if (!props.status || props.status === "info") {
          backgroundColor = "blue.700";
        }

        return {
          container: {
            borderRadius: "md",
            background: backgroundColor,
          },
        };
      },
    },
    Form: {
      baseStyle: formBaseStyle,
    },
  },
});

export default theme;

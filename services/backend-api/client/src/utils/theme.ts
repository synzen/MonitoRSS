// 1. import `extendTheme` function
import { extendTheme, ThemeConfig } from "@chakra-ui/react";
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
      baseStyle: {
        borderRadius: "md",
      },
    },
    Form: {
      baseStyle: formBaseStyle,
    },
  },
});

export default theme;

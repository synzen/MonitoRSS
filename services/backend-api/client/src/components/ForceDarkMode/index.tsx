import { useColorMode } from "@chakra-ui/react";
import { useEffect } from "react";

interface Props {
  children: React.ReactNode;
}

export const ForceDarkMode = ({ children }: Props) => {
  const { colorMode, toggleColorMode } = useColorMode();

  useEffect(() => {
    if (colorMode === "dark") {
      return;
    }

    toggleColorMode();
  }, [colorMode]);

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
};

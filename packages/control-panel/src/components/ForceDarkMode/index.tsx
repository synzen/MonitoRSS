import { useColorMode } from '@chakra-ui/react';
import { useEffect } from 'react';

export const ForceDarkMode: React.FC = ({ children }) => {
  const { colorMode, toggleColorMode } = useColorMode();

  useEffect(() => {
    if (colorMode === 'dark') {
      return;
    }

    toggleColorMode();
  }, [colorMode]);

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
};

import { createStandaloneToast, UseToastOptions } from '@chakra-ui/react';
import theme from './theme';

const { toast } = createStandaloneToast({
  theme,
});

interface Options {
  toastOptions?: UseToastOptions;
}

export const notifyError = (title: string, error: Error | string, options?: Options) => {
  toast({
    title,
    description: typeof error === 'string' ? error : error.message,
    status: 'error',
    position: 'top',
    ...options,
  });
};

import './utils/i18n';
import React from 'react';
import ReactDOM from 'react-dom';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';
import theme from './utils/theme';
import setupMockBrowserWorker from './mocks/browser';
import { ForceDarkMode } from './components/ForceDarkMode';

async function prepare() {
  if (import.meta.env.MODE === 'development-mockapi') {
    return setupMockBrowserWorker().then((worker) => worker.start());
  }

  return Promise.resolve();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      refetchOnWindowFocus: false,
    },
  },
});

prepare().then(() => {
  ReactDOM.render(
    <React.StrictMode>
      <BrowserRouter>
        <ChakraProvider>
          <ColorModeScript initialColorMode={theme.config.initialColorMode} />
          <QueryClientProvider client={queryClient}>
            <ForceDarkMode>
              <App />
            </ForceDarkMode>
          </QueryClientProvider>
        </ChakraProvider>
      </BrowserRouter>
    </React.StrictMode>,
    document.getElementById('root'),
  );
});

import { URL } from 'node:url';

export const getUrlHost = (url: string) => {
  return new URL(url).host;
};

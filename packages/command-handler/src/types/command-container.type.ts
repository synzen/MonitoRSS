import { MonitoServices } from '@monitorss/services';
import Logger from '../utils/logger';

export interface CommandProfile {
  locale?: string;
}

export type CommandTranslate = (toTranslate: string) => string;

export type CommandServices = MonitoServices;

export type CommandLogger = Logger;

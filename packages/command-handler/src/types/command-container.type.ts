import { MonitoServices } from '@monitorss/services';
import Logger from '../utils/logger';

export interface CommandProfile {
  locale?: string;
}

export type CommandTranslate = (toTranslate: string) => string;

export type CommandServices = MonitoServices;

export type CommandLogger = Logger;


export const commandContainerSymbols = {
  Command: Symbol('Command'),
  CommandTranslate: Symbol('CommandTranslate'),
  CommandProfile: Symbol('CommandProfile'),
  CommandServices: Symbol('CommandServices'),
  CommandLogger: Symbol('CommandLogger'),
};

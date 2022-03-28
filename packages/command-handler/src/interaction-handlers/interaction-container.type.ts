import { MonitoServices } from '@monitorss/services';
import Logger from '../utils/logger';

export interface InteractionProfile {
  locale?: string;
}

export type InteractionTranslate = (toTranslate: string, data?: Record<string, any>) => string;

export type InteractionServices = MonitoServices;

export type InteractionLogger = Logger;

export const InteractionContainerSymbols = {
  Command: Symbol('Command'),
  Translate: Symbol('InteractionTranslate'),
  Profile: Symbol('InteractionProfile'),
  Services: Symbol('InteractionServices'),
  Logger: Symbol('InteractionLogger'),
} as const;

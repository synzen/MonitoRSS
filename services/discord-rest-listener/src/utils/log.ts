import { OtlpLogger } from '@monitorss/logger'
import winston from 'winston'
import config from './config'

const timestampFormat = winston.format.timestamp()

const devLog = winston.createLogger({
  transports: [
    new winston.transports.Console(),
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    timestampFormat,
    winston.format.simple(),
  )
})

let datadogLog: winston.Logger;

if (config.datadog) {
  console.log('Setting up datadog')
  datadogLog = winston.createLogger({
    level: 'info',
    exitOnError: false,
    format: winston.format.json(),
    transports: [
      new winston.transports.Http({
        host: config.datadog.host,
        path: `/v1/input/${config.datadog.apiKey}?ddsource=nodejs&service=${config.datadog.service}`,
        ssl: true
      }),
    ],
  });
  datadogLog.on('error', err => {
    devLog.error(err)
  })
}

let otlpLog: OtlpLogger | undefined;

if (config.otlp?.endpoint && config.otlp.headers && config.otlp.service) {
  console.log('Setting up otlp')
  otlpLog = new OtlpLogger({
    env: process.env.NODE_ENV as string,
    endpoint: config.otlp.endpoint,
    headers: config.otlp.headers,
    service: config.otlp.service,
    useInEnvs: ['production'],
  });
}

export const logDatadog = (level: string, message: string, meta?: any) => {
  if (datadogLog) {
    datadogLog.log(level, message, meta);
  }
  // During the dual-ship window, datadog-only messages also ship to OTLP.
  if (otlpLog) {
    otlpLog.log(level as 'debug' | 'info' | 'warn' | 'error', { message, ...meta });
  }
}

const log = devLog

export default log

import type { Connection as MongoConnection } from "mongoose";
import type { Connection as RabbitConnection } from "rabbitmq-client";
import type { Config } from "./config";
import { createAuthService, type AuthService } from "./infra/auth";
import { createPublisher } from "./infra/rabbitmq";

export interface Container {
  config: Config;
  mongoConnection: MongoConnection;
  rabbitmq: RabbitConnection;
  authService: AuthService;
  publishMessage: (queue: string, message: unknown) => Promise<void>;
}

export function createContainer(deps: {
  config: Config;
  mongoConnection: MongoConnection;
  rabbitmq: RabbitConnection;
}): Container {
  const authService = createAuthService(deps.config);
  const publishMessage = createPublisher(deps.rabbitmq);

  return {
    config: deps.config,
    mongoConnection: deps.mongoConnection,
    rabbitmq: deps.rabbitmq,
    authService,
    publishMessage,
  };
}

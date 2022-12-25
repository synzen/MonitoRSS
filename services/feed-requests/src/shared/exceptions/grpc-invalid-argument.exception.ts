import { RpcException } from '@nestjs/microservices';

export class GrpcInvalidArgumentException extends RpcException {
  constructor(message?: string) {
    super({
      code: 3,
      message,
    });
  }
}

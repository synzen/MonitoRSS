import { RpcException } from '@nestjs/microservices';

export class GrpcInternalException extends RpcException {
  constructor() {
    super({
      code: 13,
    });
  }
}

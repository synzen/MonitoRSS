import qs from "qs";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";

export const NestedQuery = createParamDecorator(
  (field: string, ctx: ExecutionContext) => {
    const request: FastifyRequest = ctx.switchToHttp().getRequest();
    const query = request.url.split("?")[1];

    const parsed = qs.parse(query);

    return field ? parsed[field] : parsed;
  }
);

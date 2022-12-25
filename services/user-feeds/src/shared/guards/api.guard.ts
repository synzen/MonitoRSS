import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Observable } from "rxjs";

@Injectable()
export class ApiGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const apiKey = this.configService.getOrThrow<string>(
      "USER_FEEDS_API_KEY"
    );

    const request = context.switchToHttp().getRequest();

    const headers = request.headers;

    if (headers["api-key"] !== apiKey) {
      throw new UnauthorizedException();
    }

    return true;
  }
}

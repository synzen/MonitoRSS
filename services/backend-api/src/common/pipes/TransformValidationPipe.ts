import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  ValidationPipe,
} from "@nestjs/common";

@Injectable()
export class TransformValidationPipe implements PipeTransform {
  transform(value: never, metadata: ArgumentMetadata) {
    const originalPipe = new ValidationPipe({
      transform: true,
      validateCustomDecorators: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    return originalPipe.transform(value, metadata);
  }
}

import { BadRequestException, ValidationPipe } from "@nestjs/common";


export const AppValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors) => {
    const formattedErrors = errors.map(err => ({
      field: err.property,
      message: Object.values(err.constraints ?? {}).join(', '),
    }));
    return new BadRequestException(formattedErrors);
  },
});
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateEvaluationReportDto {
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  childId: number;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  reportId: number;

  @IsString()
  @IsNotEmpty()
  terms: string; 

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  export?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  approve?: boolean;
}
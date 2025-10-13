import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationReportsService } from './evaluation-reports.service';

describe('EvaluationReportsService', () => {
  let service: EvaluationReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvaluationReportsService],
    }).compile();

    service = module.get<EvaluationReportsService>(EvaluationReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

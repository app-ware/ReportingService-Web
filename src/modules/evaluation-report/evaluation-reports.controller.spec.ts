import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationReportsController } from './evaluation-reports.controller';
import { EvaluationReportsService } from './evaluation-reports.service';

describe('EvaluationReportsController', () => {
  let controller: EvaluationReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluationReportsController],
      providers: [EvaluationReportsService],
    }).compile();

    controller = module.get<EvaluationReportsController>(EvaluationReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

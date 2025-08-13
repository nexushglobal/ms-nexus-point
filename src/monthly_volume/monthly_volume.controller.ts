import { Controller } from '@nestjs/common';
import { MonthlyVolumeService } from './monthly_volume.service';

@Controller()
export class MonthlyVolumeController {
  constructor(private readonly monthlyVolumeService: MonthlyVolumeService) {}
}

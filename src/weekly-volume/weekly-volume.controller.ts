import { Controller } from '@nestjs/common';
import { WeeklyVolumeService } from './weekly-volume.service';

@Controller()
export class WeeklyVolumeController {
  constructor(private readonly weeklyVolumeService: WeeklyVolumeService) {}
}

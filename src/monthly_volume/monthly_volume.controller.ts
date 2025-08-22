import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MonthlyVolumeService } from './monthly_volume.service';
import { GetUserMonthlyVolumesDto } from './dto/get-user-monthly-volumes.dto';
import { CreateMonthlyVolumeDto } from './dto/create-monthly-volume.dto';

@Controller()
export class MonthlyVolumeController {
  constructor(private readonly monthlyVolumeService: MonthlyVolumeService) {}

  @MessagePattern({ cmd: 'monthlyVolume.getUserMonthlyVolumes' })
  async getUserMonthlyVolumes(
    @Payload() getUserMonthlyVolumesDto: GetUserMonthlyVolumesDto,
  ) {
    return this.monthlyVolumeService.getUserMonthlyVolumes(
      getUserMonthlyVolumesDto,
    );
  }

  @MessagePattern({ cmd: 'monthlyVolume.createMonthlyVolume' })
  async createMonthlyVolume(
    @Payload() createMonthlyVolumeDto: CreateMonthlyVolumeDto,
  ) {
    return this.monthlyVolumeService.createMonthlyVolume(
      createMonthlyVolumeDto,
    );
  }
}

import { Controller } from '@nestjs/common';
import { WeeklyVolumeService } from './weekly-volume.service';
import { MessagePattern } from '@nestjs/microservices';
import { CreateVolumeDto } from './dto/create-volume.dto';
import { GetUserWeeklyVolumesDto } from './dto/get-user-weekly-volumes.dto';
import { GetWeeklyVolumeDetailDto } from './dto/get-weekly-volume-detail.dto';
import { GetWeeklyVolumeHistoryDto } from './dto/get-weekly-volume-history.dto';

@Controller('weekly-volume')
export class WeeklyVolumeController {
  constructor(private readonly weeklyVolumeService: WeeklyVolumeService) {}

  @MessagePattern({ cmd: 'weeklyVolume.createVolume' })
  async createVolume(addVolumeDto: CreateVolumeDto) {
    return this.weeklyVolumeService.createVolume(addVolumeDto);
  }

  @MessagePattern({ cmd: 'weeklyVolume.getUserWeeklyVolumes' })
  async getUserWeeklyVolumes(dto: GetUserWeeklyVolumesDto) {
    return this.weeklyVolumeService.getUserWeeklyVolumes(dto);
  }

  @MessagePattern({ cmd: 'weeklyVolume.getWeeklyVolumeDetail' })
  async getWeeklyVolumeDetail(dto: GetWeeklyVolumeDetailDto) {
    return this.weeklyVolumeService.getWeeklyVolumeDetail(dto);
  }

  @MessagePattern({ cmd: 'weeklyVolume.getWeeklyVolumeHistory' })
  async getWeeklyVolumeHistory(dto: GetWeeklyVolumeHistoryDto) {
    return this.weeklyVolumeService.getWeeklyVolumeHistory(dto);
  }
}

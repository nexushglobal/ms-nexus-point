import { Controller } from '@nestjs/common';
import { WeeklyVolumeService } from './weekly-volume.service';
import { MessagePattern } from '@nestjs/microservices';
import { CreateVolumeDto } from './dto/create-volume.dto';

@Controller('weekly-volume')
export class WeeklyVolumeController {
  constructor(private readonly weeklyVolumeService: WeeklyVolumeService) {}

  @MessagePattern({ cmd: 'weeklyVolume.createVolume' })
  async createVolume(addVolumeDto: CreateVolumeDto) {
    return this.weeklyVolumeService.createVolume(addVolumeDto);
  }
}

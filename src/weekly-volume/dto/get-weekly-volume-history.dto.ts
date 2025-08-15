import { IsNumber, IsPositive } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class GetWeeklyVolumeHistoryDto extends PaginationDto {
  @IsNumber()
  @IsPositive()
  weeklyVolumeId: number;
}

export class WeeklyVolumeHistoryResponseDto {
  id: number;
  paymentId?: string;
  volumeSide?: string;
  volume: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

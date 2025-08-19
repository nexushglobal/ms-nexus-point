import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class GetUserWeeklyVolumesDto extends PaginationDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(['PENDING', 'PROCESSED', 'CANCELLED'], {
    message: 'Status debe ser PENDING, PROCESSED o CANCELLED',
  })
  status?: string;

  @IsOptional()
  @IsDateString({}, { message: 'startDate debe ser una fecha válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate debe ser una fecha válida' })
  endDate?: string;
}

export class WeeklyVolumeResponseDto {
  id: number;
  leftVolume: number;
  rightVolume: number;
  commissionEarned?: number;
  weekStartDate: Date;
  weekEndDate: Date;
  status: string;
  selectedSide?: string;
  processedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

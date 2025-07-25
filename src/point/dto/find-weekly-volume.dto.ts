import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  PointTransactionStatus,
  PointTransactionType,
} from '../entities/points-transaction.entity';
import { VolumeProcessingStatus } from 'src/weekly-volume/entities/weekly-volume.entity';

export class FindPointsTransactionDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsEnum(PointTransactionType)
  type?: PointTransactionType;

  @IsOptional()
  @IsEnum(PointTransactionStatus)
  status?: PointTransactionStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class FindWeeklyVolumeDto extends PaginationDto {
  @IsOptional()
  @IsEnum(VolumeProcessingStatus)
  status?: VolumeProcessingStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

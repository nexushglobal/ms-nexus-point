import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  PointTransactionStatus,
  PointTransactionType,
} from '../entities/points-transaction.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class GetPointsTransactionsDto extends PaginationDto {
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

export class GetPointsTransactionsResponseDto {
  id: number;
  userId: string;
  userEmail: string;
  userName?: string;
  type: string;
  amount: number;
  pendingAmount: number;
  withdrawnAmount: number;
  status: string;
  isArchived: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

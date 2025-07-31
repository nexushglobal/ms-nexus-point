import { Paginated } from 'src/common/dto/paginated.dto';
import { PaymentDetailResponseDto } from './payment-detail.dto';
import { GetPointsTransactionsResponseDto } from './get-points-transactions.dto';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class GetUserPointsTransactionPaymentsDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsOptional()
  paginationDto: PaginationDto;
}

export class GetUserPointsTransactionPaymentsResponseDto extends GetPointsTransactionsResponseDto {
  listPayments: Paginated<PaymentDetailResponseDto>;
}

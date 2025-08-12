// approve-withdrawal.dto.ts

import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

export class WithdrawalPointDto {
  @IsString({
    message: 'El ID de transacción de puntos debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El ID de transacción de puntos es requerido' })
  pointsTransactionId: string;

  @IsNumber({}, { message: 'El monto usado debe ser un número' })
  @IsNotEmpty({ message: 'El monto usado es requerido' })
  amountUsed: number;
}

export class ApproveWithdrawalDto {
  @IsNumber({}, { message: 'El ID del retiro debe ser un número' })
  @IsNotEmpty({ message: 'El ID del retiro es requerido' })
  withdrawalId: number;

  @IsString({ message: 'El ID del usuario debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El ID del usuario es requerido' })
  userId: string;

  @IsString({ message: 'El ID del revisor debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El ID del revisor es requerido' })
  reviewerId: string;

  @IsEmail({}, { message: 'El email del revisor debe ser un email válido' })
  @IsNotEmpty({ message: 'El email del revisor es requerido' })
  reviewerEmail: string;

  @IsArray({ message: 'Los puntos de retiro deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => WithdrawalPointDto)
  withdrawalPoints: WithdrawalPointDto[];
}

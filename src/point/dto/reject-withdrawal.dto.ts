import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { WithdrawalPointDto } from './approve-withdrawal.dto';

export class RejectWithdrawalDto {
  @IsNumber({}, { message: 'El ID del retiro debe ser un número' })
  @IsNotEmpty({ message: 'El ID del retiro es requerido' })
  withdrawalId: number;

  @IsString({ message: 'El ID del usuario debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El ID del usuario es requerido' })
  userId: string;

  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsNotEmpty({ message: 'El monto es requerido' })
  amount: number;

  @IsString({ message: 'El ID del revisor debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El ID del revisor es requerido' })
  reviewerId: string;

  @IsEmail({}, { message: 'El email del revisor debe ser un email válido' })
  @IsNotEmpty({ message: 'El email del revisor es requerido' })
  reviewerEmail: string;

  @IsString({ message: 'La razón de rechazo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La razón de rechazo es requerida' })
  rejectionReason: string;

  @IsArray({ message: 'Los puntos de retiro deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => WithdrawalPointDto)
  withdrawalPoints: WithdrawalPointDto[];
}

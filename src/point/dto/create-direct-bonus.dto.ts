import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DirectBonusUserDto {
  @IsString()
  @IsNotEmpty()
  userId: string; // ID del usuario que compró (para buscar su referente)

  @IsString()
  @IsNotEmpty()
  paymentReference: string; // Referencia del pago de este usuario

  @IsNumber()
  @IsNotEmpty()
  paymentId: number; // ID del pago de este usuario
}

export class CreateDirectBonusDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectBonusUserDto)
  users: DirectBonusUserDto[];
}

export class ProcessedDirectBonusDto {
  referrerUserId: string; // ID del referente que recibió el bono
  referredUserId: string; // ID del usuario que compró
  bonusAmount: number; // Cantidad del bono otorgado
  paymentReference: string; // Referencia del pago
  transactionId: number; // ID de la transacción de puntos creada
}

export class FailedDirectBonusDto {
  userId: string; // ID del usuario que falló
  paymentReference: string; // Referencia del pago
  reason: string; // Razón del fallo
}

export class DirectBonusResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessedDirectBonusDto)
  processed: ProcessedDirectBonusDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FailedDirectBonusDto)
  failed: FailedDirectBonusDto[];
}

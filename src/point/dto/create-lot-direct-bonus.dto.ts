import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateLotPointsDto {
  @IsString({ message: 'El campo ID de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo ID de usuario es obligatorio' })
  userId: string;

  @IsString({ message: 'El campo nombre de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo nombre de usuario es obligatorio' })
  userName: string;

  @IsString({ message: 'El campo email de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo email de usuario es obligatorio' })
  userEmail: string;

  @IsNumber({}, { message: 'El campo de puntos debe ser un número' })
  @IsNotEmpty({ message: 'El campo de puntos es obligatorio' })
  points: number;

  @IsString({ message: 'El campo de referencia es una cadena de texto' })
  @IsOptional()
  reference?: string;
}

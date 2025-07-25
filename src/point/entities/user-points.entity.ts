import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PointsTransaction } from './points-transaction.entity';

@Entity('user_points')
@Index(['userId'], { unique: true })
@Index(['updatedAt'])
export class UserPoints {
  @PrimaryColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: string; // UUID del usuario desde el microservicio de usuarios

  @Column({ name: 'user_email' })
  userEmail: string; // Email para referencia rápida

  @Column({ name: 'user_name', nullable: true })
  userName?: string; // Nombre completo para referencia

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'available_points',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  availablePoints: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'total_earned_points',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalEarnedPoints: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'total_withdrawn_points',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalWithdrawnPoints: number;

  // ========== PUNTOS DE LOTES ==========
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'available_lot_points',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  availableLotPoints: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'total_earned_lot_points',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalEarnedLotPoints: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'total_withdrawn_lot_points',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalWithdrawnLotPoints: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => PointsTransaction, (transaction) => transaction.userId)
  transactions: PointsTransaction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.availablePoints < 0) {
      throw new Error('Los puntos disponibles no pueden ser negativos');
    }

    if (this.totalEarnedPoints < 0) {
      throw new Error('Los puntos totales ganados no pueden ser negativos');
    }

    if (this.totalWithdrawnPoints < 0) {
      throw new Error('Los puntos retirados no pueden ser negativos');
    }

    // Validar consistencia
    if (this.totalWithdrawnPoints > this.totalEarnedPoints) {
      throw new Error(
        'Los puntos retirados no pueden ser mayores a los puntos ganados',
      );
    }

    // Limpiar campos de texto
    if (this.userEmail) {
      this.userEmail = this.userEmail.toLowerCase().trim();
    }

    if (this.userName) {
      this.userName = this.userName.trim();
    }
  }

  canWithdraw(amount: number): boolean {
    return this.availablePoints >= amount && amount > 0;
  }

  getWithdrawalRate(): number {
    if (this.totalEarnedPoints === 0) return 0;
    return (this.totalWithdrawnPoints / this.totalEarnedPoints) * 100;
  }
}

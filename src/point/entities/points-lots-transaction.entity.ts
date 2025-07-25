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
import { PointsTransactionPayment } from './points-transaction-payment.entity';

export enum LotPointTransactionType {
  LOT_BINARY_COMMISSION = 'LOT_BINARY_COMMISSION',
  LOT_DIRECT_BONUS = 'LOT_DIRECT_BONUS',
  LOT_WITHDRAWAL = 'LOT_WITHDRAWAL',
}

export enum LotPointTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

@Entity('lot_points_transactions')
@Index(['userId', 'status'])
@Index(['type', 'createdAt'])
@Index(['status', 'createdAt'])
export class LotPointsTransaction {
  @PrimaryColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: string; // UUID del usuario desde el microservicio de usuarios

  @Column({ name: 'user_email' })
  userEmail: string; // Email para referencia rápida

  @Column({ name: 'user_name', nullable: true })
  userName?: string; // Nombre completo para referencia

  @Column({
    type: 'enum',
    enum: LotPointTransactionType,
  })
  type: LotPointTransactionType;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'pending_amount',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pendingAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'withdrawn_amount',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  withdrawnAmount: number;

  @Column({
    type: 'enum',
    enum: LotPointTransactionStatus,
    default: LotPointTransactionStatus.PENDING,
  })
  status: LotPointTransactionStatus;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @OneToMany(
    () => PointsTransactionPayment,
    (payment) => payment.pointsTransaction,
    { cascade: true },
  )
  payments: PointsTransactionPayment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.amount < 0) {
      throw new Error('El monto no puede ser negativo');
    }

    if (this.pendingAmount < 0) {
      throw new Error('El monto pendiente no puede ser negativo');
    }

    if (this.withdrawnAmount < 0) {
      throw new Error('El monto retirado no puede ser negativo');
    }

    if (this.withdrawnAmount > this.amount) {
      throw new Error('El monto retirado no puede ser mayor al monto total');
    }

    if (this.userEmail) {
      this.userEmail = this.userEmail.toLowerCase().trim();
    }

    if (this.userName) {
      this.userName = this.userName.trim();
    }
  }

  // Métodos helper
  getRemainingAmount(): number {
    return this.amount - this.withdrawnAmount;
  }

  isCompleted(): boolean {
    return this.status === LotPointTransactionStatus.COMPLETED;
  }

  canWithdraw(): boolean {
    return (
      this.status === LotPointTransactionStatus.COMPLETED &&
      this.getRemainingAmount() > 0 &&
      !this.isArchived
    );
  }
}

import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PointsTransaction } from './points-transaction.entity';

@Entity('points_transaction_payments')
@Index(['pointsTransaction'])
@Index(['paymentId'])
@Index(['createdAt'])
export class PointsTransactionPayment {
  @PrimaryColumn()
  id: number;

  @ManyToOne(() => PointsTransaction, (transaction) => transaction.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'points_transaction_id' })
  pointsTransaction: PointsTransaction;

  @Column({ name: 'payment_id' })
  paymentId: string; // UUID del pago desde el microservicio de payments

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

  @Column({ name: 'payment_reference', nullable: true })
  paymentReference?: string;

  @Column({ name: 'payment_method', nullable: true })
  paymentMethod?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Limpiar campos de texto
    if (this.paymentReference) {
      this.paymentReference = this.paymentReference.trim();
    }

    if (this.paymentMethod) {
      this.paymentMethod = this.paymentMethod.trim();
    }

    if (this.notes) {
      this.notes = this.notes.trim();
    }
  }
}

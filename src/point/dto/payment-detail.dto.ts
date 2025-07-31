export class PaymentDetailResponseDto {
  id: number;
  amount: number;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: Date;
}

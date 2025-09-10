import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { MembershipService } from './services/memberships.service';
import { OrdersService } from './services/orders.service';
import { PaymentsService } from './services/payments.service';

@Module({
  providers: [UsersService, MembershipService, OrdersService, PaymentsService],
  exports: [UsersService, MembershipService, OrdersService, PaymentsService],
})
export class CommonModule {}

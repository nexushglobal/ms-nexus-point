import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { MembershipService } from './services/memberships.service';
import { OrdersService } from './services/orders.service';

@Module({
  providers: [UsersService, MembershipService, OrdersService],
  exports: [UsersService, MembershipService, OrdersService],
})
export class CommonModule {}

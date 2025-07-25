import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { MembershipService } from './services/memberships.service';

@Module({
  providers: [UsersService, MembershipService],
  exports: [UsersService, MembershipService],
})
export class CommonModule {}

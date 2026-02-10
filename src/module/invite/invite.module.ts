import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [InviteController],
  providers: [InviteService],
  imports: [TypeOrmModule.forFeature([User]), UsersModule],
})
export class InviteModule {}

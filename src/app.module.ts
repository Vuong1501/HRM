import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './module/auth/auth.module';
import { UsersModule } from './module/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './database/typeorm.config';
import { ConfigModule } from '@nestjs/config';
import { HrModule } from './module/hr/hr.module';
import { MailModule } from './module/mail/mail.module';
import { InviteModule } from './module/invite/invite.module';
import { CaslModule } from './module/casl/casl.module';
import { LeaveModule } from './module/leave/leave.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    HrModule,
    MailModule,
    InviteModule,
    CaslModule,
    LeaveModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


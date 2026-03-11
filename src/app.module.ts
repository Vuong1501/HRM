import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './module/auth/auth.module';
import { UsersModule } from './module/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HrModule } from './module/hr/hr.module';
import { MailModule } from './module/mail/mail.module';
import { InviteModule } from './module/invite/invite.module';
import { CaslModule } from './module/casl/casl.module';
import { LeaveModule } from './module/leave/leave.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OtModule } from './module/ot/ot.module';
import { CalendarModule } from './module/calendar/calendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
        synchronize: false,
        autoLoadEntities: true,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        logging: configService.get<string>('NODE_ENV') === 'production' ? ['error'] : [ 'error'],
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    HrModule,
    MailModule,
    InviteModule,
    CaslModule,
    LeaveModule,
    OtModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


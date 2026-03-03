import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';

export const typeOrmConfig: TypeOrmModuleOptions = {
  ...databaseConfig,
  autoLoadEntities: true,
  // type: 'mysql',
  // host: 'localhost',
  // port: 3306,
  // username: 'root',
  // password: 'vuong2003',
  // database: 'hrm_base',
  // autoLoadEntities: false,
  // synchronize: false,
  // migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  // logging:
  //   process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error'],
};

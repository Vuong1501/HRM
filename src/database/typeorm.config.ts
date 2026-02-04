import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'vuong2003',
  database: 'hrm_base',
  autoLoadEntities: true,
  synchronize: true,
};

import { DataSource } from 'typeorm';
import {databaseConfig} from './database.config';

export const AppDataSource = new DataSource({
  ...databaseConfig,
   entities: [__dirname + '/../**/*.entity.{js,ts}'],
});
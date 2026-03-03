import { config } from 'dotenv';
config();
export const databaseConfig = {
  type: 'mysql' as const,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
};
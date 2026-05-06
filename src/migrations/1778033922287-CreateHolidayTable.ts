import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHolidayTable1778033922287 implements MigrationInterface {
    name = 'CreateHolidayTable1778033922287'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`holidays\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`startDate\` date NOT NULL, \`endDate\` date NOT NULL, \`duration\` int NOT NULL, \`year\` int NOT NULL, \`isRecurring\` tinyint NOT NULL DEFAULT 0, \`createdBy\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`holidays\``);
    }

}

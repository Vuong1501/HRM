import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveIsRecurringFromHoliday1778055498628 implements MigrationInterface {
    name = 'RemoveIsRecurringFromHoliday1778055498628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`holidays\` DROP COLUMN \`isRecurring\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`holidays\` ADD \`isRecurring\` tinyint NOT NULL DEFAULT '0'`);
    }

}

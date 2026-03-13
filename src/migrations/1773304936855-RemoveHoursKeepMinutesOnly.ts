import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveHoursKeepMinutesOnly1773304936855 implements MigrationInterface {
    name = 'RemoveHoursKeepMinutesOnly1773304936855'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`actualHours\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`compensatoryHours\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`otHours\``);
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` DROP COLUMN \`hours\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`compensatoryMinutes\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`otMinutes\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`otMinutes\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`compensatoryMinutes\``);
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` ADD \`hours\` decimal(5,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`otHours\` decimal(5,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`compensatoryHours\` decimal(7,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`actualHours\` decimal(5,2) NULL`);
    }

}

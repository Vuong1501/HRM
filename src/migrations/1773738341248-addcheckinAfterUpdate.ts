import { MigrationInterface, QueryRunner } from "typeorm";

export class AddcheckinAfterUpdate1773738341248 implements MigrationInterface {
    name = 'AddcheckinAfterUpdate1773738341248'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`checkInAfterUpdate\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`checkOutAfterUpdate\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`updateReason\` text NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`updateReason\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`checkOutAfterUpdate\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`checkInAfterUpdate\``);
    }

}

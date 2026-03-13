import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRejectedReasonToOtPlanEmployee1773367962022 implements MigrationInterface {
    name = 'AddRejectedReasonToOtPlanEmployee1773367962022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`rejectedReason\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`rejectedReason\``);
    }

}

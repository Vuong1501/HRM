import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActualMinutesToOtPlanEmployee1773285523932 implements MigrationInterface {
    name = 'AddActualMinutesToOtPlanEmployee1773285523932'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`actualMinutes\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`actualMinutes\``);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVersionToOtPlan1773718703667 implements MigrationInterface {
    name = 'AddVersionToOtPlan1773718703667'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plans\` ADD \`version\` int NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plans\` DROP COLUMN \`version\``);
    }

}

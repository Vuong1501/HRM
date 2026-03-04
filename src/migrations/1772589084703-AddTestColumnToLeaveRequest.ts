import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTestColumnToLeaveRequest1772589084703 implements MigrationInterface {
    name = 'AddTestColumnToLeaveRequest1772589084703'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`leave_requests\` ADD \`testColumn\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`leave_requests\` DROP COLUMN \`testColumn\``);
    }

}

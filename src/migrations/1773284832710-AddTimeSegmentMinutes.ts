import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimeSegmentMinutes1773284832710 implements MigrationInterface {
    name = 'AddTimeSegmentMinutes1773284832710'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` ADD \`minutes\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` ADD CONSTRAINT \`FK_98e4cf0352f5eb7030ac245cd09\` FOREIGN KEY (\`otPlanEmployeeId\`) REFERENCES \`ot_plan_employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` DROP FOREIGN KEY \`FK_98e4cf0352f5eb7030ac245cd09\``);
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` DROP COLUMN \`minutes\``);
    }

}

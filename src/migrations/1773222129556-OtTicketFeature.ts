import { MigrationInterface, QueryRunner } from "typeorm";

export class OtTicketFeature1773222129556 implements MigrationInterface {
    name = 'OtTicketFeature1773222129556'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ot_time_segments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`otPlanEmployeeId\` int NOT NULL, \`date\` date NOT NULL, \`segmentType\` enum ('WEEKDAY_DAY', 'WEEKDAY_NIGHT', 'WEEKEND_DAY', 'WEEKEND_NIGHT', 'HOLIDAY_DAY', 'HOLIDAY_NIGHT') NOT NULL, \`startTime\` datetime NOT NULL, \`endTime\` datetime NOT NULL, \`hours\` decimal(5,2) NOT NULL, INDEX \`IDX_98e4cf0352f5eb7030ac245cd0\` (\`otPlanEmployeeId\`), INDEX \`IDX_96563a29780d06a5ac070a73a3\` (\`otPlanEmployeeId\`, \`date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`mode\` enum ('OT', 'COMPENSATORY') NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`compensatoryHours\` decimal(7,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`otHours\` decimal(5,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`workContent\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD \`note\` text NULL`);
        
        // Fix duplicate index: first drop the index manually
        await queryRunner.query(`DROP INDEX \`IDX_845d0b177261f4238dd9b62bc8\` ON \`ot_plan_employees\``);
        
        // Then alter the column enum
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` MODIFY \`status\` enum ('waiting', 'pending', 'inprogress', 'submitted', 'absent', 'cancelled', 'approved', 'updated', 'rejected') NOT NULL DEFAULT 'pending'`);
        
        // Recreate the index
        await queryRunner.query(`CREATE INDEX \`IDX_845d0b177261f4238dd9b62bc8\` ON \`ot_plan_employees\` (\`employeeId\`, \`status\`)`);
        
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` ADD CONSTRAINT \`FK_98e4cf0352f5eb7030ac245cd09\` FOREIGN KEY (\`otPlanEmployeeId\`) REFERENCES \`ot_plan_employees\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_time_segments\` DROP FOREIGN KEY \`FK_98e4cf0352f5eb7030ac245cd09\``);
        await queryRunner.query(`DROP INDEX \`IDX_845d0b177261f4238dd9b62bc8\` ON \`ot_plan_employees\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` MODIFY \`status\` enum ('waiting', 'pending', 'inprogress', 'submitted', 'absent') NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`CREATE INDEX \`IDX_845d0b177261f4238dd9b62bc8\` ON \`ot_plan_employees\` (\`employeeId\`, \`status\`)`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`note\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`workContent\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`otHours\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`compensatoryHours\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP COLUMN \`mode\``);
        await queryRunner.query(`DROP INDEX \`IDX_96563a29780d06a5ac070a73a3\` ON \`ot_time_segments\``);
        await queryRunner.query(`DROP INDEX \`IDX_98e4cf0352f5eb7030ac245cd0\` ON \`ot_time_segments\``);
        await queryRunner.query(`DROP TABLE \`ot_time_segments\``);
    }

}

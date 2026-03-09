import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexOtModule1773049130042 implements MigrationInterface {
    name = 'AddIndexOtModule1773049130042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plans\` DROP FOREIGN KEY \`fk_ot_plans_approver\``);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` DROP FOREIGN KEY \`fk_ot_plans_creator\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP FOREIGN KEY \`fk_ot_plan_employees_employee\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP FOREIGN KEY \`fk_ot_plan_employees_plan\``);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` CHANGE \`updatedAt\` \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` CHANGE \`status\` \`status\` enum ('waiting', 'pending', 'inprogress', 'submitted', 'absent') NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`CREATE INDEX \`IDX_4ad434ae166fba80014ee7f71f\` ON \`ot_plans\` (\`creatorId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_a96b0995fb079dcbf824732abe\` ON \`ot_plans\` (\`status\`, \`createdAt\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_f6c37b2d016bab7d3d4ecf55e8\` ON \`ot_plan_employees\` (\`otPlanId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_845d0b177261f4238dd9b62bc8\` ON \`ot_plan_employees\` (\`employeeId\`, \`status\`)`);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` ADD CONSTRAINT \`FK_4ad434ae166fba80014ee7f71f2\` FOREIGN KEY (\`creatorId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` ADD CONSTRAINT \`FK_8479d36c87ed51d574b65935de1\` FOREIGN KEY (\`approverId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD CONSTRAINT \`FK_f6c37b2d016bab7d3d4ecf55e87\` FOREIGN KEY (\`otPlanId\`) REFERENCES \`ot_plans\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD CONSTRAINT \`FK_b5ed0c5c0a4231362be2037d0a4\` FOREIGN KEY (\`employeeId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP FOREIGN KEY \`FK_b5ed0c5c0a4231362be2037d0a4\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` DROP FOREIGN KEY \`FK_f6c37b2d016bab7d3d4ecf55e87\``);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` DROP FOREIGN KEY \`FK_8479d36c87ed51d574b65935de1\``);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` DROP FOREIGN KEY \`FK_4ad434ae166fba80014ee7f71f2\``);
        await queryRunner.query(`DROP INDEX \`IDX_845d0b177261f4238dd9b62bc8\` ON \`ot_plan_employees\``);
        await queryRunner.query(`DROP INDEX \`IDX_f6c37b2d016bab7d3d4ecf55e8\` ON \`ot_plan_employees\``);
        await queryRunner.query(`DROP INDEX \`IDX_a96b0995fb079dcbf824732abe\` ON \`ot_plans\``);
        await queryRunner.query(`DROP INDEX \`IDX_4ad434ae166fba80014ee7f71f\` ON \`ot_plans\``);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` CHANGE \`createdAt\` \`createdAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` CHANGE \`status\` \`status\` enum ('pending', 'checked_in', 'checked_out', 'absent') NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` CHANGE \`updatedAt\` \`updatedAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` CHANGE \`createdAt\` \`createdAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD CONSTRAINT \`fk_ot_plan_employees_plan\` FOREIGN KEY (\`otPlanId\`) REFERENCES \`ot_plans\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`ot_plan_employees\` ADD CONSTRAINT \`fk_ot_plan_employees_employee\` FOREIGN KEY (\`employeeId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` ADD CONSTRAINT \`fk_ot_plans_creator\` FOREIGN KEY (\`creatorId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` ADD CONSTRAINT \`fk_ot_plans_approver\` FOREIGN KEY (\`approverId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}

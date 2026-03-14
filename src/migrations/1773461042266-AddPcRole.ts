import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPcRole1773461042266 implements MigrationInterface {
    name = 'AddPcRole1773461042266'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('hr', 'employee', 'admin', 'department_lead', 'pc') NOT NULL DEFAULT 'employee'`);
        await queryRunner.query(`DROP INDEX \`IDX_a96b0995fb079dcbf824732abe\` ON \`ot_plans\``);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` CHANGE \`status\` \`status\` enum ('pending', 'approved', 'rejected', 'cancelled', 'updated') NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`CREATE INDEX \`IDX_a96b0995fb079dcbf824732abe\` ON \`ot_plans\` (\`status\`, \`createdAt\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_a96b0995fb079dcbf824732abe\` ON \`ot_plans\``);
        await queryRunner.query(`ALTER TABLE \`ot_plans\` CHANGE \`status\` \`status\` enum ('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`CREATE INDEX \`IDX_a96b0995fb079dcbf824732abe\` ON \`ot_plans\` (\`status\`, \`createdAt\`)`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('hr', 'employee', 'admin', 'department_lead') NOT NULL DEFAULT 'employee'`);
    }

}

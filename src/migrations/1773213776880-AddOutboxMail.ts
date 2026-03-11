import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxMail1773213776880 implements MigrationInterface {
    name = 'AddOutboxMail1773213776880'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`outbox_mails\` (\`id\` int NOT NULL AUTO_INCREMENT, \`recipient\` varchar(255) NOT NULL, \`template\` varchar(255) NOT NULL, \`contextJson\` longtext NOT NULL, \`status\` enum ('PENDING', 'SUCCESS', 'FAILED', 'FATAL_FAILED') NOT NULL DEFAULT 'PENDING', \`errorReason\` text NULL, \`retryCount\` int NOT NULL DEFAULT '0', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`outbox_mails\``);
    }

}

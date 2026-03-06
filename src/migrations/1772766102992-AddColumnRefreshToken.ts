import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumnRefreshToken1772766102992 implements MigrationInterface {
    name = 'AddColumnRefreshToken1772766102992'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`leave_requests\` DROP COLUMN \`testColumn\``);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`refreshToken\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`leave_attachments\` CHANGE \`fileKey\` \`fileKey\` varchar(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`leave_attachments\` CHANGE \`fileKey\` \`fileKey\` varchar(255) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`refreshToken\``);
        await queryRunner.query(`ALTER TABLE \`leave_requests\` ADD \`testColumn\` varchar(255) NULL`);
    }

}

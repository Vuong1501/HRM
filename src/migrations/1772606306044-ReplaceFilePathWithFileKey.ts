import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceFilePathWithFileKey1772606306044 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE \`leave_attachments\` ADD \`fileKey\` varchar(255) NOT NULL DEFAULT ''`
        );
        await queryRunner.query(
            `UPDATE \`leave_attachments\` SET \`fileKey\` = \`filePath\``
        );
        await queryRunner.query(
            `ALTER TABLE \`leave_attachments\` DROP COLUMN \`filePath\``
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE \`leave_attachments\` ADD \`filePath\` varchar(255) NOT NULL DEFAULT ''`
        );
        await queryRunner.query(
            `UPDATE \`leave_attachments\` SET \`filePath\` = \`fileKey\``
        );
        await queryRunner.query(
            `ALTER TABLE \`leave_attachments\` DROP COLUMN \`fileKey\``
        );
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveFileNameColumn1772608635818 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
         await queryRunner.query(
    `ALTER TABLE \`leave_attachments\` DROP COLUMN \`fileName\``
  );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
    `ALTER TABLE \`leave_attachments\` ADD \`fileName\` varchar(255) NULL`
  );
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeZohoToGoogleId1778769396223 implements MigrationInterface {
    name = 'ChangeZohoToGoogleId1778769396223'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`zohoId\` \`googleId\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`googleId\` \`zohoId\` varchar(255) NULL`);
    }

}

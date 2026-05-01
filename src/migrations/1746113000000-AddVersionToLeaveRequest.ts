import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionToLeaveRequest1746113000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm cột version cho tất cả bảng dùng BaseEntity (chỉ leave_requests cần cho optimistic lock)
    await queryRunner.query(`
      ALTER TABLE \`leave_requests\`
      ADD COLUMN \`version\` int NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`leave_requests\` DROP COLUMN \`version\`
    `);
  }
}

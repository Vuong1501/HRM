import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserDepartmentToEnum1778084206577 implements MigrationInterface {
    name = 'UpdateUserDepartmentToEnum1778084206577'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thay vì DROP và ADD (làm mất sạch dữ liệu), ta dùng MODIFY để giữ lại dữ liệu cũ nếu khớp enum
        await queryRunner.query(`ALTER TABLE \`users\` MODIFY COLUMN \`departmentName\` enum ('IT', 'HR', 'Accounting', 'Sales', 'Mail Service', 'Fullfillment', 'Board of Directors') NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` MODIFY COLUMN \`departmentName\` varchar(255) NULL`);
    }

}

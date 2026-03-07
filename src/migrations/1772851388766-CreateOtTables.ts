import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOtTables1772851388766 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE ot_plans (
                id              INT NOT NULL AUTO_INCREMENT,
                creatorId       INT NOT NULL,
                approverId      INT NULL,
                startTime       DATETIME NOT NULL,
                endTime         DATETIME NOT NULL,
                reason          TEXT NOT NULL,
                status          ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                rejectedReason  VARCHAR(255) NULL,
                approvedAt      DATETIME NULL,
                createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                CONSTRAINT fk_ot_plans_creator  FOREIGN KEY (creatorId)  REFERENCES users(id),
                CONSTRAINT fk_ot_plans_approver FOREIGN KEY (approverId) REFERENCES users(id)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE ot_plan_employees (
                id            INT NOT NULL AUTO_INCREMENT,
                otPlanId      INT NOT NULL,
                employeeId    INT NOT NULL,
                status        ENUM('pending', 'checked_in', 'checked_out', 'absent') NOT NULL DEFAULT 'pending',
                checkInTime   DATETIME NULL,
                checkOutTime  DATETIME NULL,
                actualHours   DECIMAL(5, 2) NULL,
                createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                CONSTRAINT fk_ot_plan_employees_plan     FOREIGN KEY (otPlanId)   REFERENCES ot_plans(id),
                CONSTRAINT fk_ot_plan_employees_employee FOREIGN KEY (employeeId) REFERENCES users(id)
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS ot_plan_employees`);
        await queryRunner.query(`DROP TABLE IF EXISTS ot_plans`);
    }

}

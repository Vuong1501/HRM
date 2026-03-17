import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { OtPlanEmployeeStatus } from 'src/common/enums/ot/ot-employee-status.enum';
import { OtMode } from 'src/common/enums/ot/ot-mode.enum';
import { OtPlan } from './ot-plan.entity';
import { OtTimeSegment } from './ot-time-segment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ot_plan_employees')
@Index(['employeeId', 'status'])
export class OtPlanEmployee {
  @PrimaryGeneratedColumn()
  id: number;

  @Index() 
  @Column()
  otPlanId: number;

  @Column()
  employeeId: number;

  @Column({
    type: 'enum',
    enum: OtPlanEmployeeStatus,
    default: OtPlanEmployeeStatus.PENDING,
  })
  status: OtPlanEmployeeStatus;

  @Column({ nullable: true })
  checkInTime: Date;

  @Column({ nullable: true })
  checkOutTime: Date;

  @Column({ nullable: true })
  checkInAfterUpdate: Date;

  @Column({ nullable: true })
  checkOutAfterUpdate: Date;

  @Column({ type: 'int', nullable: true })
  actualMinutes: number;

  @Column({ type: 'enum', enum: OtMode, nullable: true })
  mode: OtMode;

  @Column({ type: 'int', nullable: true })
  compensatoryMinutes: number;

  @Column({ type: 'int', nullable: true })
  otMinutes: number;

  @Column({ type: 'text', nullable: true })
  workContent: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  updateReason: string;

  @Column({ type: 'varchar', nullable: true })
  rejectedReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => OtPlan, (plan) => plan.employees)
  @JoinColumn({ name: 'otPlanId' })
  otPlan: OtPlan;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employeeId' })
  employee: User;

  @OneToMany(() => OtTimeSegment, (segment) => segment.otPlanEmployee, {
    cascade: true,
  })
  timeSegments: OtTimeSegment[];
}
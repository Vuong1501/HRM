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
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OtPlanStatus } from 'src/common/enums/ot/ot-status.enum';
import { OtPlanEmployee } from './ot-plan-employee.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('ot_plans')
@Index(['status', 'createdAt']) 
export class OtPlan extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index() 
  @Column()
  creatorId: number;

  @Column({ nullable: true })
  approverId: number | null;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: OtPlanStatus,
    default: OtPlanStatus.PENDING,
  })
  status: OtPlanStatus;

  @Column({ nullable: true })
  rejectedReason: string;

  @Column({type: 'datetime', nullable: true })
  approvedAt: Date | null;

  @VersionColumn()
  version: number;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approverId' })
  approver: User;

  @OneToMany(() => OtPlanEmployee, (emp) => emp.otPlan)
  employees: OtPlanEmployee[];
}
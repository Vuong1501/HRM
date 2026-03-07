import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OtPlanStatus } from 'src/common/enums/ot/ot-status.enum';
import { OtPlanEmployee } from './ot-plan-employee.entity';

@Entity('ot_plans')
export class OtPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  creatorId: number;

  @Column({ nullable: true })
  approverId: number;

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

  @Column({ nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

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
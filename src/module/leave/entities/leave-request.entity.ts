import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LeaveType } from 'src/common/enums/leave-type.enum';
import { LeaveRequestStatus } from 'src/common/enums/leave-request-status.enum';
import { HalfDayType } from 'src/common/enums/halfDayType.enum';

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Loại nghỉ
  @Column({
    type: 'enum',
    enum: LeaveType,
  })
  leaveType: LeaveType;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  leaveSubType: string | null;

  @Column({
    type: 'enum',
    enum: HalfDayType,
  })
  startHalfDayType: HalfDayType;

  @Column({
    type: 'enum',
    enum: HalfDayType,
  })
  endHalfDayType: HalfDayType;

  // Thời gian nghỉ
  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  // Lý do nghỉ
  @Column({ 
    type: 'text',
    nullable: true,
  })
  reason: string | null;

  // Trạng thái đơn
  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  status: LeaveRequestStatus;

  // Lý do từ chối (nếu bị reject)
  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  // Người duyệt
  @Column({ nullable: true })
  approverId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approverId' })
  approver: User | null;

  // Thời điểm duyệt
  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

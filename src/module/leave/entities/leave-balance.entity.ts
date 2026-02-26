import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('leave_balances')
@Unique(['userId', 'year'])
export class LeaveBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Năm
  @Column()
  year: number;

  // Tổng phép năm (12 ngày cho NV >= 1 năm)
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 12 })
  annualLeaveTotal: number;

  // Số phép đã sử dụng
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  annualLeaveUsed: number;

  // Số ngày nghỉ không lương đã dùng
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  unpaidLeaveUsed: number;

  // Quỹ nghỉ bù (tính bằng giờ, cộng từ OT)
  @Column({ type: 'decimal', precision: 7, scale: 1, default: 0 })
  compensatoryBalance: number;
}

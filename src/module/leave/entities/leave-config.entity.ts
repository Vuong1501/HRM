import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { LeaveType } from 'src/common/enums/leave-type.enum';

@Entity('leave_configs')
export class LeaveConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: LeaveType,
  })
  leaveType: LeaveType;

  @Column({ type: 'varchar', nullable: true })
  leaveSubType: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  limit: number;

  @Column({ type: 'boolean', default: false })
  isPerMonth: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

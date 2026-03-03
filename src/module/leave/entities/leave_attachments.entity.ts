import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { LeaveRequest } from './leave-request.entity';

@Entity('leave_attachments')
export class LeaveAttachment {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  leaveRequestId: number;

  @Column()
  originalName: string;

  @Column()
  fileName: string;

  @Column()
  filePath: string;

  @Column()
  mimeType: string;

  @Column()
  size: number;

  @CreateDateColumn()
  uploadedAt: Date;

  @ManyToOne(() => LeaveRequest, (leave) => leave.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'leaveRequestId' })
  leaveRequest: LeaveRequest;
}
import { OutboxStatus } from 'src/common/enums/outbox-status.enum';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('outbox_mails')
export class OutboxMail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  recipient: string;

  @Column()
  template: string;

  @Column({ type: 'longtext' })
  contextJson: string;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'text', nullable: true })
  errorReason: string | null;

  @Column({ default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { UserRole } from 'src/common/enums/user-role.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.INVITED,
  })
  status: UserStatus;

  @Column({ nullable: true })
  zohoId: string;

  @Column({ type: 'varchar', nullable: true })
  inviteToken: string | null;

  @Column({ nullable: true })
  inviteExpiredAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

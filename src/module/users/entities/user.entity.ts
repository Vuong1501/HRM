import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { UserRole } from 'src/common/enums/user-role.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { SexEnum } from 'src/common/enums/user-sex.enum';

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

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  departmentName: string;

  @Column({ nullable: true })
  address: string;

  @Column({
    type: 'enum',
    enum: SexEnum,
    nullable: true,
  })
  sex: SexEnum;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  // zoho
  @Column({ nullable: true })
  zohoId: string;

  // invite
  @Column({ type: 'varchar', nullable: true })
  inviteToken: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

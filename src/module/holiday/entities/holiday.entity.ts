import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('holidays')
export class Holiday {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'date' })
    startDate: string;

    @Column({ type: 'date' })
    endDate: string;

    @Column({ type: 'int' })
    duration: number;

    @Column({ type: 'int' })
    year: number;

    @Column({ type: 'boolean', default: false })
    isRecurring: boolean; // true = lặp lại hàng năm (ngày dương cố định)

    @Column({ nullable: true })
    createdBy: number; // id của người tạo, không cần rela với user

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

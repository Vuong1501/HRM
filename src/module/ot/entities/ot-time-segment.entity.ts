import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OtPlanEmployee } from './ot-plan-employee.entity';
import { OtSegmentType } from 'src/common/enums/ot/ot-segment-type.enum';

@Entity('ot_time_segments')
@Index(['otPlanEmployeeId', 'date'])
export class OtTimeSegment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  otPlanEmployeeId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'enum', enum: OtSegmentType })
  segmentType: OtSegmentType;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ type: 'int' })
  minutes: number;

  // Relations
  @ManyToOne(() => OtPlanEmployee, (ope) => ope.timeSegments)
  @JoinColumn({ name: 'otPlanEmployeeId' })
  otPlanEmployee: OtPlanEmployee;
}

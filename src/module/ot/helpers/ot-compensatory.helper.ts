import { Injectable } from '@nestjs/common';
import { OtTimeSegment } from '../entities/ot-time-segment.entity';
import { OtSegmentType } from 'src/common/enums/ot/ot-segment-type.enum';

@Injectable()
export class OtCompensatoryHelper {

  calculateCompensatory(segments: OtTimeSegment[]): {
    compensatoryMinutes: number;
    otMinutes: number;
    otBreakdown: Array<{ segmentType: OtSegmentType; minutes: number }>;
  } {
    const totalMinutes = segments.reduce((sum, s) => sum + Number(s.minutes), 0);

    const compensatoryMinutes = Math.floor(totalMinutes / 240) * 240;
    const otMinutes = totalMinutes - compensatoryMinutes;

    // Duyệt segment theo thứ tự thời gian, lấy compensatory từ đầu
    let remaining = compensatoryMinutes;
    const otBreakdown: Array<{ segmentType: OtSegmentType; minutes: number }> = [];

    for (const seg of segments) {
      const segMinutes = Number(seg.minutes);

      if (remaining >= segMinutes) {
        remaining -= segMinutes;
      } else {
        const otPartMinutes = segMinutes - remaining;
        remaining = 0;
        otBreakdown.push({
          segmentType: seg.segmentType,
          minutes: otPartMinutes,
        });
      }
    }

    return { compensatoryMinutes, otMinutes, otBreakdown };
  }
}

import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { CalendarService } from '../../calendar/calendar.service';
import { OtSegmentType } from 'src/common/enums/ot/ot-segment-type.enum';
import { OT_TICKET_CONSTANTS } from '../ot-ticket.constants';

dayjs.extend(isBetween);

@Injectable()
export class OtTimeSegmentHelper {
  constructor(private readonly calendarService: CalendarService) {}

  async splitIntoSegments(
    checkIn: Date,
    checkOut: Date,
  ): Promise<
    Array<{
      date: string;
      segmentType: OtSegmentType;
      startTime: Date;
      endTime: Date;
      minutes: number;
    }>
  > {
    const segments: Array<{
      date: string;
      segmentType: OtSegmentType;
      startTime: Date;
      endTime: Date;
      minutes: number;
    }> = [];
    
    let currentStart = dayjs(checkIn);
    const end = dayjs(checkOut);

    while (currentStart.isBefore(end)) {
      const currentEnd = this.getNextBoundary(currentStart, end);
      const minutes = currentEnd.diff(currentStart, 'minute');

      const isWeekendOrHoliday = await this.calendarService.isWeekendOrHoliday(
        currentStart,
      );
      
      const isNight = this.isNightTime(currentStart);

      let segmentType: OtSegmentType;
      if (isWeekendOrHoliday) {
         segmentType = isNight ? OtSegmentType.WEEKEND_NIGHT : OtSegmentType.WEEKEND_DAY;
      } else {
         segmentType = isNight ? OtSegmentType.WEEKDAY_NIGHT : OtSegmentType.WEEKDAY_DAY;
      }

      segments.push({
        date: currentStart.format('YYYY-MM-DD'),
        segmentType,
        startTime: currentStart.toDate(),
        endTime: currentEnd.toDate(),
        minutes,
      });

      currentStart = currentEnd;
    }

    return segments;
  }

  private getNextBoundary(start: dayjs.Dayjs, absoluteEnd: dayjs.Dayjs): dayjs.Dayjs {
    const boundaries = [
      start.clone().hour(0).minute(0).second(0).add(1, 'day'),
      start.clone().hour(OT_TICKET_CONSTANTS.NIGHT_END_HOUR).minute(0).second(0),
      start.clone().hour(OT_TICKET_CONSTANTS.NIGHT_START_HOUR).minute(0).second(0),
    ].filter((b) => b.isAfter(start));

    const nextBoundary = boundaries.reduce((min, b) => (b.isBefore(min) ? b : min), boundaries[0]);

    return nextBoundary.isBefore(absoluteEnd) ? nextBoundary : absoluteEnd;
  }

  private isNightTime(time: dayjs.Dayjs): boolean {
    const hour = time.hour();
    return hour >= OT_TICKET_CONSTANTS.NIGHT_START_HOUR || hour < OT_TICKET_CONSTANTS.NIGHT_END_HOUR;
  }
}

import { Injectable } from '@nestjs/common';
import dayjs, { Dayjs } from 'dayjs';

@Injectable()
export class CalendarService {



    async isHoliday(date: Dayjs): Promise<boolean> {
        return false;
    }

    isWeekend(date: Dayjs): boolean {
        const day = date.day();
        return day === 0 || day === 6;
    }

    async isWeekendOrHoliday(date: Dayjs): Promise<boolean> {
        return this.isWeekend(date) || this.isHoliday(date);
    }
}

import {
    Injectable,
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Holiday } from './entities/holiday.entity';
import { Repository } from 'typeorm';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import dayjs, { Dayjs } from 'dayjs';
import { HOLIDAY_ERRORS } from './holiday.errors';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidayService {

    constructor(
        @InjectRepository(Holiday)
        private readonly holidayRepository: Repository<Holiday>,
    ) { }

    async createHoliday(userId: number, dto: CreateHolidayDto) {
        const startDate = dayjs(dto.startDate);
        const endDate = dayjs(dto.endDate);

        if (startDate.isAfter(endDate)) {
            throw new BadRequestException(HOLIDAY_ERRORS.INVALID_DATE_RANGE);
        }

        const duration = endDate.diff(startDate, 'day') + 1;
        const year = startDate.year();

        await this.checkOverlap(dto.startDate, dto.endDate);

        const holiday = this.holidayRepository.create({
            name: dto.name,
            startDate: dto.startDate,
            endDate: dto.endDate,
            duration,
            year,
            createdBy: userId,
        })

        await this.holidayRepository.save(holiday);
        return { message: 'Thêm ngày nghỉ thành công', holiday };
    }

    async getListHoliday(year: number) {
        const holidays = await this.holidayRepository.find({
            where: { year },
            order: { startDate: 'ASC' },
        })
         const totalDays = holidays.reduce((sum, h) => sum + h.duration, 0);

        return {holidays, totalDays };
        
    }

    async updateHoliday(holidayId: number, dto: UpdateHolidayDto){
        const holiday = await this.holidayRepository.findOneBy({id: holidayId});
        if(!holiday) throw new NotFoundException(HOLIDAY_ERRORS.HOLIDAY_NOT_FOUND);

        if(dto.startDate || dto.endDate){
            const startDate = dayjs(dto.startDate ?? holiday.startDate);
            const endDate = dayjs(dto.endDate ?? holiday.endDate);

            if (startDate.isAfter(endDate)) {
                throw new BadRequestException(HOLIDAY_ERRORS.INVALID_DATE_RANGE);
            }
            holiday.duration = endDate.diff(startDate, 'day') + 1;
            holiday.year = startDate.year();

            await this.checkOverlap(
                startDate.format('YYYY-MM-DD'),
                endDate.format('YYYY-MM-DD'),
                holidayId,
            );
        }
        Object.assign(holiday, dto); // ghi đè các trường trong dto lên holiday, còn lại giữ nguyên
        await this.holidayRepository.save(holiday);

        return { message: 'Cập nhật ngày nghỉ thành công', holiday };
        
    }

    async getDetailHoliday(holidayId: number){
        const holiday = await this.holidayRepository.findOneBy({id: holidayId});
        if(!holiday) throw new NotFoundException(HOLIDAY_ERRORS.HOLIDAY_NOT_FOUND);
        return holiday;
    }

    async deleteHoliday(holidayId: number){
        const holiday = await this.holidayRepository.findOneBy({id: holidayId});
        if(!holiday) throw new NotFoundException(HOLIDAY_ERRORS.HOLIDAY_NOT_FOUND);
        await this.holidayRepository.remove(holiday);
        return { message: 'Xóa ngày nghỉ thành công' };
    }

    async isHoliday(date: Dayjs): Promise<boolean> {
        const dateStr = date.format('YYYY-MM-DD');
        const holiday = await this.holidayRepository
            .createQueryBuilder('h')
            .where(':date BETWEEN h.startDate AND h.endDate', { date: dateStr })
            .getOne();
        return !!holiday;
    }

    isWeekend(date: Dayjs): boolean {
        const day = date.day();
        return day === 0 || day === 6;
    }

    async isWeekendOrHoliday(date: Dayjs): Promise<boolean> {
        return this.isWeekend(date) || this.isHoliday(date);
    }

    private async checkOverlap(startDate: string, endDate: string,  excludeId?: number){
        const qb = this.holidayRepository
            .createQueryBuilder('h')
            .where('h.startDate <= :endDate AND h.endDate >= :startDate', {
                startDate,
                endDate
            });
        if(excludeId){
            qb.andWhere('h.id != :id', {id: excludeId});
        };

        const overlap = await qb.getOne();
        if(overlap){
            throw new BadRequestException({
                ...HOLIDAY_ERRORS.HOLIDAY_OVERLAP,
                detail: `Trùng với ngày nghỉ "${overlap.name}"`
            });
        }
            
    }

    // lấy ngày nghỉ theo năm
    async getHolidaysByYear(year: number): Promise<Holiday[]> {
        return this.holidayRepository.find({ where: { year } });
    }
}

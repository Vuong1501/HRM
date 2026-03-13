import { IsEnum, IsString, MaxLength, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtMode } from 'src/common/enums/ot/ot-mode.enum';
import { OT_TICKET_CONSTANTS } from '../ot-ticket.constants';

export class SubmitOtTicketDto {
  @ApiProperty({ enum: OtMode, description: 'Chế độ OT hoặc Nghỉ bù' })
  @IsEnum(OtMode, { message: 'Mode phải là OT hoặc COMPENSATORY' })
  @IsNotEmpty({ message: 'Vui lòng chọn chế độ mong muốn' })
  mode: OtMode;

  @ApiProperty({ description: 'Nội dung công việc đã làm' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung công việc không được để trống' })
  @MaxLength(OT_TICKET_CONSTANTS.WORK_CONTENT_MAX_LENGTH, {
    message: `Nội dung công việc không được vượt quá ${OT_TICKET_CONSTANTS.WORK_CONTENT_MAX_LENGTH} ký tự`,
  })
  workContent: string;

  @ApiPropertyOptional({ description: 'Ghi chú thêm (nếu có)' })
  @IsOptional()
  @IsString()
  @MaxLength(OT_TICKET_CONSTANTS.NOTE_MAX_LENGTH, {
    message: `Ghi chú không được vượt quá ${OT_TICKET_CONSTANTS.NOTE_MAX_LENGTH} ký tự`,
  })
  note?: string;
}

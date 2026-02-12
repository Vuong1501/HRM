import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { InviteDto } from './invite.dto';

export class BulkInviteDto {
  @ApiProperty({
    description: 'Danh sách user cần mời',
    type: [InviteDto],
    example: [
      {
        email: 'user1@gmail.com',
        name: 'User 1',
        dateOfBirth: '1999-01-01',
        departmentName: 'IT',
        role: 'employee',
        address: 'Ha Noi',
        sex: 'male',
        phoneNumber: '0987654321',
        startDate: '2025-02-01',
      },
      {
        email: 'user2@gmail.com',
        name: 'User 2',
        dateOfBirth: '1998-05-15',
        departmentName: 'HR',
        role: 'employee',
        address: 'HCM',
        sex: 'female',
        phoneNumber: '0912345678',
        startDate: '2025-02-01',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải có ít nhất 1 user' })
  @ValidateNested({ each: true })
  @Type(() => InviteDto)
  users: InviteDto[];
}

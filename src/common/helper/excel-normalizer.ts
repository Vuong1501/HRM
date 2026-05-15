import { UserRole } from '../enums/user-role.enum';
import { EmploymentType } from '../enums/user-employeeType.enum';
import { SexEnum } from '../enums/user-sex.enum';
import { Department } from '../enums/department.enum';
import { RawInviteRow } from 'src/module/hr/dto/raw-invite-row';
import dayjs from 'dayjs';

const EXCEL_EPOCH_OFFSET = 25569; // số ngày từ 1/1/1900 (Excel epoch) đến 1/1/1970 (Unix epoch)
const MS_PER_DAY = 86400 * 1000;  // số milliseconds trong 1 ngày

export function normalizeDate(value: any): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return dayjs(value).format('YYYY-MM-DD');
  }

  if (typeof value === 'number') {
    return dayjs((value - EXCEL_EPOCH_OFFSET) * MS_PER_DAY).format('YYYY-MM-DD');
  }

  if (typeof value === 'string') {
    const parts = value.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return dayjs(`${year}-${month}-${day}`).format('YYYY-MM-DD');
    }
  }

  return undefined;
}

export function normalizeRowKeys(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // bỏ double space
        .replace(/[:]/g, '') // bỏ dấu :
        .replace(/\r/g, ''), // bỏ ký tự ẩn
      value,
    ]),
  );
}

export function getValueByAliases(
  row: Record<string, unknown>,
  aliases: string[],
): unknown {
  for (const alias of aliases) {
    if (alias in row) {
      return row[alias];
    }
  }
  return undefined;
}

export function normalizeRole(raw: string | undefined): {
  role: UserRole | undefined;
  employmentType: EmploymentType | undefined;
} {
  if (!raw) {
    return {
      role: undefined,
      employmentType: undefined,
    };
  }
  const v = raw.toLowerCase().trim();

  let role: UserRole | undefined = undefined;
  let employmentType: EmploymentType | undefined = undefined;

  // Xác định Role
  if (v.includes('admin')) role = UserRole.ADMIN;
  else if (v.includes('hr') || v.includes('nhân sự')) role = UserRole.HR;
  else if (v.includes('lead') || v.includes('trưởng phòng')) role = UserRole.DEPARTMENT_LEAD;
  else if (v.includes('pc') || v.includes('coordinator')) role = UserRole.PROJECT_COORDINATOR;
  else if (v.includes('nhân viên') || v.includes('employee')) role = UserRole.EMPLOYEE;

  // Xác định Loại hợp đồng
  if (v.includes('intern') || v.includes('thực tập')) employmentType = EmploymentType.INTERN;
  else if (v.includes('thử việc') || v.includes('probation')) employmentType = EmploymentType.PROBATION;
  else if (v.includes('chính thức') || v.includes('official')) employmentType = EmploymentType.OFFICIAL;

  return {
    role,
    employmentType,
  };
}

export function normalizeDepartment(raw: string | undefined): Department | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase().trim();

  if (v.includes('it') || v.includes('công nghệ')) return Department.IT;
  if (v.includes('hr') || v.includes('nhân sự')) return Department.HR;
  if (v.includes('kế toán') || v.includes('accounting') || v.includes('tài chính')) return Department.ACCOUNTING;
  if (v.includes('kinh doanh') || v.includes('sales') || v.includes('bán hàng')) return Department.SALES;
  if (v.includes('mail service')) return Department.MAIL_SERVICE;
  if (v.includes('fullfillment')) return Department.FULLFILLMENT;
  if (v.includes('chủ tịch') || v.includes('ban giám đốc') || v.includes('board')) return Department.BOARD_OF_DIRECTORS;

  return undefined;
}

export function normalizeSex(raw: string | undefined): SexEnum | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase().trim();

  if (v === 'nam' || v === 'male' || v === 'm') return SexEnum.MALE;
  if (v === 'nữ' || v === 'female' || v === 'f') return SexEnum.FEMALE;
  if (v === 'khác' || v === 'other') return SexEnum.OTHER;

  return undefined;
}

export const HEADER_MAP: Record<keyof RawInviteRow, string[]> = {
  email: ['zoho mail', 'google mail', 'email', 'zoho email'],
  name: ['name', 'full name'],
  dob: ['dob', 'date of birth', 'birthday'],
  department: ['department', 'dept'],
  roleRaw: ['role', 'position'],
  address: ['address'],
  sex: ['sex', 'gender'],
  phone: ['phone number', 'phone', 'mobile'],
  startDate: ['start date', 'joining date'],
};

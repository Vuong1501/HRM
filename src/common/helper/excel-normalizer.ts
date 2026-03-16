import { UserRole } from '../enums/user-role.enum';
import { EmploymentType } from '../enums/user-employeeType.enum';
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

export function normalizeRole(raw: string): {
  role: UserRole;
  employmentType: EmploymentType;
} {
  const v = raw.toLowerCase();

  let employmentType = EmploymentType.OFFICIAL;

  if (v.includes('intern')) employmentType = EmploymentType.INTERN;
  else if (v.includes('thử')) employmentType = EmploymentType.PROBATION;

  return {
    role: UserRole.EMPLOYEE,
    employmentType,
  };
}

export const HEADER_MAP: Record<keyof RawInviteRow, string[]> = {
  email: ['zoho mail', 'email', 'zoho email'],
  name: ['name', 'full name'],
  dob: ['dob', 'date of birth', 'birthday'],
  department: ['department', 'dept'],
  roleRaw: ['role', 'position'],
  address: ['address'],
  sex: ['sex', 'gender'],
  phone: ['phone number', 'phone', 'mobile'],
  startDate: ['start date', 'joining date'],
};

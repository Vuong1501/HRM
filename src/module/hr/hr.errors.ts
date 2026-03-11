export const HR_ERRORS = {
  EMAIL_ALREADY_EXISTS: {
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'Email đã tồn tại trong hệ thống',
  },
  INVITE_TOKEN_INVALID: {
    code: 'INVITE_TOKEN_INVALID',
    message: 'Token không hợp lệ hoặc đã hết hạn',
  },
  FILE_REQUIRED: {
    code: 'FILE_REQUIRED',
    message: 'Vui lòng cung cấp file Excel',
  },
} as const;
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
    PC_ROLE_CAN_ONLY_BE_IN_IT_DEPARTMENT: {
    code: 'ERR_PC_ROLE_CAN_ONLY_BE_IN_IT_DEPARTMENT',
    message: 'Vai trò Project Coordinator chỉ dành cho phòng ban IT',
},

} as const;
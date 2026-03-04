export const APP_ERRORS = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Bạn chưa đăng nhập',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Bạn không có quyền thực hiện hành động này',
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Lỗi hệ thống, vui lòng thử lại sau',
  },
  INVALID_INVITE: {
    code: 'INVALID_INVITE',
    message: 'Lời mời không hợp lệ',
  },
  INVITE_ALREADY_USED: {
    code: 'INVITE_ALREADY_USED',
    message: 'Lời mời đã được sử dụng',
  },
  EMAIL_MISMATCH: {
    code: 'EMAIL_MISMATCH',
    message: 'Email Zoho không khớp lời mời',
  },
  USER_NOT_REGISTERED: {
    code: 'USER_NOT_REGISTERED',
    message: 'Người dùng chưa được đăng ký',
  },
  USER_NOT_ACTIVE: {
    code: 'USER_NOT_ACTIVE',
    message: 'Tài khoản chưa được kích hoạt',
  },
  DEV_LOGIN_DISABLED: {
    code: 'DEV_LOGIN_DISABLED',
    message: 'Dev login bị vô hiệu hóa trong production',
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'Không tìm thấy người dùng',
  },
  VIEW_USER_FORBIDDEN: {
    code: 'VIEW_USER_FORBIDDEN',
    message: 'Bạn không có quyền xem thông tin này',
  },
} as const;
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
} as const;
export const MAIL_ERRORS = {
  SEND_INVITE_FAILED: {
    code: 'SEND_INVITE_FAILED',
    message: 'Gửi mail mời thất bại, vui lòng thử lại',
  },
  SEND_LEAVE_NOTIFICATION_FAILED: {
    code: 'SEND_LEAVE_NOTIFICATION_FAILED',
    message: 'Gửi mail thông báo nghỉ thất bại',
  },
  SEND_LEAVE_APPROVED_FAILED: {
    code: 'SEND_LEAVE_APPROVED_FAILED',
    message: 'Gửi mail thông báo duyệt thất bại',
  },
} as const;
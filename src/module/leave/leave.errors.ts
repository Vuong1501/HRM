export const LEAVE_ERRORS = {
  INSURANCE_REQUIRES_ATTACHMENT: {
    code: 'INSURANCE_REQUIRES_ATTACHMENT',
    message: 'Nghỉ bảo hiểm bắt buộc phải đính kèm hồ sơ',
  },
  LEAVE_NOT_FOUND: {
    code: 'LEAVE_NOT_FOUND',
    message: 'Không tìm thấy đơn nghỉ',
  },
  INVALID_DATE_RANGE: {
    code: 'INVALID_DATE_RANGE',
    message: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc',
  },
  INVALID_HALF_DAY: {
    code: 'INVALID_HALF_DAY',
    message: 'Buổi bắt đầu không thể sau buổi kết thúc trong cùng một ngày',
  },
  PAST_DATE_NOT_ALLOWED: {
    code: 'PAST_DATE_NOT_ALLOWED',
    message: 'Chỉ được phép điền ngày nghỉ trong quá khứ trong tháng hiện tại',
  },
  SCHEDULE_CONFLICT: {
    code: 'SCHEDULE_CONFLICT',
    message: 'Trùng lịch nghỉ với đơn đã tồn tại',
  },
  INSUFFICIENT_ANNUAL_LEAVE: {
    code: 'INSUFFICIENT_ANNUAL_LEAVE',
    message: 'Không đủ ngày phép năm',
  },
  INSUFFICIENT_COMPENSATORY: {
    code: 'INSUFFICIENT_COMPENSATORY',
    message: 'Không đủ giờ nghỉ bù',
  },
  SUBTYPE_QUOTA_EXCEEDED: {
    code: 'SUBTYPE_QUOTA_EXCEEDED',
    message: 'Vượt quá hạn mức ngày nghỉ',
  },
  NOT_OFFICIAL_EMPLOYEE: {
    code: 'NOT_OFFICIAL_EMPLOYEE',
    message: 'Bạn chưa lên chính thức nên chưa được sử dụng phép năm hoặc nghỉ bảo hiểm',
  },
  CANNOT_CANCEL: {
    code: 'CANNOT_CANCEL',
    message: 'Không thể hủy đơn ở trạng thái này',
  },
  CANCEL_REASON_REQUIRED: {
    code: 'CANCEL_REASON_REQUIRED',
    message: 'Cần nhập lý do khi hủy đơn đã được duyệt',
  },
  EMPLOYEE_NOT_FOUND: {
    code: 'EMPLOYEE_NOT_FOUND',
    message: 'Không tìm thấy nhân viên',
  },
  APPROVER_NOT_FOUND: {
    code: 'APPROVER_NOT_FOUND',
    message: 'Không tìm thấy người duyệt',
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'Không tìm thấy người dùng',
  },
  APPROVE_OWN_DEPARTMENT_ONLY: {
    code: 'APPROVE_OWN_DEPARTMENT_ONLY',
    message: 'Bạn chỉ có thể duyệt đơn của nhân viên trong phòng ban mình',
  },
  REJECT_OWN_DEPARTMENT_ONLY: {
    code: 'REJECT_OWN_DEPARTMENT_ONLY',
    message: 'Bạn chỉ có thể từ chối đơn của nhân viên trong phòng ban mình',
  },
  CANNOT_APPROVE: {
    code: 'CANNOT_APPROVE',
    message: 'Đơn này không thể duyệt',
  },
  NOT_PENDING_STATUS: {
    code: 'NOT_PENDING_STATUS',
    message: 'Đơn này không ở trạng thái chờ duyệt',
  },
  ONLY_UPDATE_OWN: {
    code: 'ONLY_UPDATE_OWN',
    message: 'Bạn chỉ có thể cập nhật đơn của mình',
  },
  ONLY_UPDATE_PENDING: {
    code: 'ONLY_UPDATE_PENDING',
    message: 'Chỉ có thể cập nhật đơn ở trạng thái chờ duyệt',
  },
  ONLY_VIEW_OWN: {
    code: 'ONLY_VIEW_OWN',
    message: 'Bạn chỉ có thể xem chi tiết đơn của mình',
  },
  VIEW_OWN_DEPARTMENT_ONLY: {
    code: 'VIEW_OWN_DEPARTMENT_ONLY',
    message: 'Bạn chỉ có quyền xem đơn của nhân viên trong phòng ban mình',
  },
  CANCEL_OWN_ONLY: {
    code: 'CANCEL_OWN_ONLY',
    message: 'Bạn không có quyền hủy đơn này',
  },
  SUBTYPE_REQUIRED: {
    code: 'SUBTYPE_REQUIRED',
    message: 'leaveSubType là bắt buộc',
  },
  SUBTYPE_NOT_FOUND: {
    code: 'SUBTYPE_NOT_FOUND',
    message: 'Không tìm thấy loại nghỉ',
  },
  SUBTYPE_NOT_ALLOWED: {
    code: 'SUBTYPE_NOT_ALLOWED',
    message: 'Loại nghỉ này không được có leaveSubType',
  },
  SUBTYPE_INVALID: {
    code: 'SUBTYPE_INVALID',
    message: 'leaveSubType không tồn tại trong hệ thống',
  },
  ATTACHMENT_NOT_FOUND: {
    code: 'ATTACHMENT_NOT_FOUND',
    message: 'Không tìm thấy file',
  },
  VIEW_ATTACHMENT_FORBIDDEN: {
    code: 'VIEW_ATTACHMENT_FORBIDDEN',
    message: 'Bạn không có quyền xem file này',
  },
  START_DATE_REQUIRED: {
    code: 'START_DATE_REQUIRED',
    message: 'Nhân viên chưa có startDate',
  },
  START_DATE_NOT_FUTURE: {
    code: 'START_DATE_NOT_FUTURE',
    message: 'startDate không được là ngày trong tương lai',
  },
} as const;
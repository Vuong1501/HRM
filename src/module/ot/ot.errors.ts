export const OT_ERRORS = {
  INVALID_TIME_RANGE: {
    code: 'INVALID_TIME_RANGE',
    message: 'Thời gian bắt đầu phải trước thời gian kết thúc',
  },
  EMPLOYEE_NOT_FOUND: {
    code: 'EMPLOYEE_NOT_FOUND',
    message: 'Không tìm thấy nhân viên',
  },
  OT_PLAN_NOT_FOUND: {
    code: 'OT_PLAN_NOT_FOUND',
    message: 'Không tìm thấy kế hoạch OT',
  },
  OT_PLAN_NOT_PENDING: {
    code: 'OT_PLAN_NOT_PENDING',
    message: 'Kế hoạch OT không ở trạng thái chờ duyệt',
  },
  OT_PLAN_NOT_APPROVED: {
    code: 'OT_PLAN_NOT_APPROVED',
    message: 'Kế hoạch OT chưa được duyệt',
  },
  ONLY_OWN_DEPARTMENT: {
    code: 'ONLY_OWN_DEPARTMENT',
    message: 'Bạn chỉ có thể tạo OT cho nhân viên trong phòng ban mình',
  },
  EMPLOYEE_NOT_IN_PLAN: {
    code: 'EMPLOYEE_NOT_IN_PLAN',
    message: 'Nhân viên không có trong kế hoạch OT này',
  },
  SCHEDULE_CONFLICT_LEAVE: {
    code: 'SCHEDULE_CONFLICT_LEAVE',
    message: 'Thời gian OT trùng với lịch nghỉ đã được duyệt',
  },
  SCHEDULE_CONFLICT_OT: {
    code: 'SCHEDULE_CONFLICT_OT',
    message: 'Thời gian OT trùng với kế hoạch OT khác',
  },
  ALREADY_CHECKED_IN: {
    code: 'ALREADY_CHECKED_IN',
    message: 'Nhân viên đã check-in rồi',
  },
  NOT_CHECKED_IN: {
    code: 'NOT_CHECKED_IN',
    message: 'Nhân viên chưa check-in',
  },
  WEEKDAY_OT_MUST_START_AFTER_1730: {
    code: 'WEEKDAY_OT_MUST_START_AFTER_1730',
    message: 'Ngày thường chỉ được tạo OT từ 17:30 trở đi',
  },
  WEEKDAY_OT_MAX_4_HOURS: {
    code: 'WEEKDAY_OT_MAX_4_HOURS',
    message: 'Ngày thường OT tối đa 4 tiếng',
  },
  WEEKEND_OT_MAX_8_HOURS: {
    code: 'WEEKEND_OT_MAX_8_HOURS',
    message: 'Cuối tuần/lễ OT tối đa 8 tiếng',
  },
  SEND_OT_NOTIFICATION_FAILED: {
    code: 'SEND_OT_NOTIFICATION_FAILED',
    message: 'Gửi mail thông báo OT cho nhân viên thất bại',
  },
  SEND_OT_PLAN_SUBMITTED_FAILED: {
    code: 'SEND_OT_PLAN_SUBMITTED_FAILED',
    message: 'Gửi mail thông báo OT cho admin thất bại',
  },
  ADMIN_NOT_FOUND: {
    code: 'ADMIN_NOT_FOUND',
    message: 'Không tìm thấy admin',
  },
  ONLY_ADMIN_APPROVE: {
    code: 'ONLY_ADMIN_APPROVE',
    message: 'Chỉ admin mới có quyền duyệt đơn OT plan'
  },
  ONLY_ADMIN_REJECT: {
    code: 'ONLY_ADMIN_REJECT',
    message: 'Chỉ admin mới có quyền từ chối đơn OT plan'
  },
  ONLY_ADMIN_OR_LEAD_IT_APPROVE: {
    code: 'ONLY_ADMIN_OR_LEAD_IT_APPROVE',
    message: 'Chỉ admin hoặc Quản lý phòng IT mới có quyền duyệt đơn này'
  },
  ONLY_ADMIN_OR_LEAD_IT_REJECT: {
    code: 'ONLY_ADMIN_OR_LEAD_IT_REJECT',
    message: 'Chỉ admin hoặc Quản lý phòng IT mới có quyền từ chối đơn này'
  },
  REJECT_REASON_REQUIRED: {
    code: 'REJECT_REASON_REQUIRED',
    message: 'Vui lòng cung cấp lý do từ chối đơn OT'
  },
  CHECKIN_NOT_ALLOWED: {
    code: 'CHECKIN_NOT_ALLOWED',
    message: 'Chưa đến thời gian check-in. Khung giờ check-in bắt đầu từ ngày OT.',
  },
  CHECKIN_EXPIRED: {
    code: 'CHECKIN_EXPIRED',
    message: 'Đã quá thời hạn check-in (23:59 ngày kế tiếp)',
  },
  CHECKOUT_TOO_EARLY: {
    code: 'CHECKOUT_TOO_EARLY',
    message: 'Phải check-out sau thời gian check-in ít nhất 1 giờ',
  },
  CHECKOUT_EXPIRED: {
    code: 'CHECKOUT_EXPIRED',
    message: 'Đã quá thời hạn check-out hệ thống cho phép',
  },
  ALREADY_CHECKED_OUT: {
    code: 'ALREADY_CHECKED_OUT',
    message: 'Ticket đã được check-out. Không thể check-out lại',
  },
  ALREADY_SUBMITTED: {
    code: 'ALREADY_SUBMITTED',
    message: 'Báo cáo OT đã được gửi đi',
  },
  TICKET_NOT_INPROGRESS: {
    code: 'TICKET_NOT_INPROGRESS',
    message: 'Ticket chưa check-in hoặc đã bị hủy/gửi',
  },
  COMPENSATORY_NOT_ELIGIBLE: {
    code: 'COMPENSATORY_NOT_ELIGIBLE',
    message: 'Bạn chưa làm đủ giờ để có thể chọn chế độ Nghỉ bù',
  },
  WORK_CONTENT_REQUIRED: {
    code: 'WORK_CONTENT_REQUIRED',
    message: 'Nội dung công việc là bắt buộc khi submit báo cáo',
  },
  TICKET_NOT_FOUND: {
    code: 'TICKET_NOT_FOUND',
    message: 'Không tìm thấy OT Ticket của bạn',
  },
  NOT_YOUR_TICKET: {
    code: 'NOT_YOUR_TICKET',
    message: 'Bạn không có quyền thao tác trên ticket này',
  },
  TICKET_NOT_SUBMITTED: {
    code: 'TICKET_NOT_SUBMITTED',
    message: 'Báo cáo OT chưa được nhân viên submit',
  },
  NOT_YOUR_DEPARTMENT_TICKET: {
    code: 'NOT_YOUR_DEPARTMENT_TICKET',
    message: 'Bạn chỉ có thể duyệt ticket của nhân viên trong phòng ban mình',
  },
  HR_NOT_FOUND: {
    code: 'HR_NOT_FOUND',
    message: 'Không tìm thấy HR',
  },
} as const;
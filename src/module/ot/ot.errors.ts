export const OT_ERRORS = {
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
} as const;
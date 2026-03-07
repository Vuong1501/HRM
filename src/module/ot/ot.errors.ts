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
} as const;
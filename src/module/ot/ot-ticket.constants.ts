export const OT_TICKET_CONSTANTS = {
  // Ranh giới ban đêm
  NIGHT_START_HOUR: 22,
  NIGHT_END_HOUR: 6,

  // Giới hạn check-out
  MIN_CHECKOUT_AFTER_CHECKIN_HOURS: 1, // Ít nhất 1 tiếng sau check-in
  MAX_CHECKOUT_WEEKDAY_HOURS: 4,       // Auto checkout ngày thường
  MAX_CHECKOUT_WEEKEND_HOURS: 8,       // Auto checkout cuối tuần
  
  // Timeout auto checkout nếu NV quên (hệ thống quét sau)
  AUTO_CHECKOUT_TIMEOUT_HOURS: 8, 

  // Quy định nghỉ bù
  MIN_COMPENSATORY_HOURS: 4, // Tối thiểu 4h mới được nghỉ bù

  // Giới hạn nội dung (character)
  WORK_CONTENT_MAX_LENGTH: 1000,
  NOTE_MAX_LENGTH: 1000,
};

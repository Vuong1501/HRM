export enum LeaveRequestStatus {
  PENDING = 'pending', // Mới tạo, chờ duyệt
  APPROVED = 'approved', // Được duyệt
  REJECTED = 'rejected', // Bị từ chối
  CANCELLED = 'cancelled', // Nhân viên tự hủy
}

// Kiểu dữ liệu trả về của API môn học, khớp components/schemas trong docs/openapi-spec.yaml.

export interface Course {
  id: number;
  code: string;
  name: string;
  credits: number;
  description: string | null;
}

export interface CoursePage {
  items: Course[];
  page: number;
  pageSize: number;
  total: number;
}

// passed chỉ có khi người gọi là sinh viên; quản trị viên thì bỏ trống.
export interface PrerequisiteStatus extends Course {
  passed?: boolean;
}

export interface ScheduleSlot {
  dayOfWeek: number; // 1 là thứ Hai, 7 là Chủ nhật
  startPeriod: number;
  endPeriod: number; // tính cả tiết cuối
  room: string | null;
}

export interface Section {
  id: number;
  courseId: number;
  semesterId: number;
  code: string;
  lecturerName: string | null;
  capacity: number;
  enrolledCount: number;
  remainingSeats: number;
  waitlistCount: number;
  slots: ScheduleSlot[];
}

export interface CourseDetail extends Course {
  prerequisites: PrerequisiteStatus[];
  sections: Section[];
}

import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { errorMessage } from './errorMessages';

describe('errorMessage', () => {
  it('Giữ nguyên thông báo trùng lịch theo Gherkin US-11 từ backend', () => {
    const message = 'Schedule clash with MA101-01';
    expect(errorMessage(new ApiError(409, { code: 'SCHEDULE_CLASH', message }))).toBe(message);
  });
  it('Liệt kê môn tiên quyết còn thiếu', () => {
    const error = new ApiError(422, {
      code: 'PREREQUISITE_NOT_MET',
      message: 'x',
      details: { missingCourses: [{ code: 'CS101' }] },
    });
    expect(errorMessage(error)).toBe('Bạn chưa đạt môn tiên quyết: CS101.');
  });

  it('Nêu lớp bị trùng lịch', () => {
    const error = new ApiError(409, {
      code: 'SCHEDULE_CLASH',
      message: 'x',
      details: { conflictsWith: [{ sectionCode: 'MA101-01' }] },
    });
    expect(errorMessage(error)).toContain('MA101-01');
  });

  it('Hiện số tín chỉ hiện tại và giới hạn', () => {
    const error = new ApiError(422, {
      code: 'CREDIT_LIMIT_EXCEEDED',
      message: 'x',
      details: { currentCredits: 22, limit: 24 },
    });
    expect(errorMessage(error)).toBe('Vượt giới hạn tín chỉ: đang có 22, giới hạn 24.');
  });

  it('Nêu số sinh viên đã đăng ký khi giảm sức chứa quá mức', () => {
    const error = new ApiError(409, {
      code: 'CAPACITY_BELOW_ENROLLED',
      message: 'x',
      details: { capacity: 10, enrolledCount: 12 },
    });
    expect(errorMessage(error)).toBe('Sức chứa mới thấp hơn số sinh viên đã đăng ký (12).');
  });

  it('Liệt kê trường sai khi VALIDATION_ERROR có details.fields', () => {
    const error = new ApiError(400, {
      code: 'VALIDATION_ERROR',
      message: 'x',
      details: { fields: { 'slots[0]': 'endPeriod must not be lower than startPeriod' } },
    });
    expect(errorMessage(error)).toBe(
      'Dữ liệu nhập chưa hợp lệ (slots[0]: endPeriod must not be lower than startPeriod).',
    );
  });

  it('Lỗi không phải từ API thì trả câu chung', () => {
    expect(errorMessage(new Error('boom'))).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.');
  });
});

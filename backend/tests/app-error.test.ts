import { AppError, notFound, validationError } from '../src/common/app-error';
import { isNonEmptyString, isPositiveInteger, parseId } from '../src/common/validation';

describe('AppError', () => {
  it('Giữ mã lỗi, mã HTTP và chi tiết', () => {
    const error = new AppError('SECTION_FULL', 409, 'Section is full.', { waitlistCount: 3 });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('SECTION_FULL');
    expect(error.status).toBe(409);
    expect(error.details).toEqual({ waitlistCount: 3 });
  });

  it('notFound trả lỗi 404 NOT_FOUND', () => {
    const error = notFound('Course');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('validationError liệt kê các trường sai', () => {
    expect(validationError({ credits: 'must be positive' }).details).toEqual({
      fields: { credits: 'must be positive' },
    });
  });
});

describe('validation', () => {
  it('parseId nhận số nguyên dương', () => {
    expect(parseId('12', 'courseId')).toBe(12);
  });

  it('parseId từ chối chữ, số âm và số thập phân', () => {
    expect(() => parseId('abc', 'courseId')).toThrow(AppError);
    expect(() => parseId('-1', 'courseId')).toThrow(AppError);
    expect(() => parseId('1.5', 'courseId')).toThrow(AppError);
    expect(() => parseId(undefined, 'courseId')).toThrow(AppError);
  });

  it('isNonEmptyString và isPositiveInteger', () => {
    expect(isNonEmptyString(' CS101 ')).toBe(true);
    expect(isNonEmptyString('  ')).toBe(false);
    expect(isNonEmptyString(3)).toBe(false);
    expect(isPositiveInteger(3)).toBe(true);
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger('3')).toBe(false);
  });
});
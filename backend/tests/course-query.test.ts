import { AppError } from '../src/common/app-error';
import { parseCourseQuery } from '../src/courses/course-query';

// Lấy danh sách trường sai trong lỗi VALIDATION_ERROR.
function invalidFields(query: Record<string, unknown>): string[] {
  try {
    parseCourseQuery(query);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return Object.keys((error as AppError).details?.fields as Record<string, string>);
  }
  throw new Error('parseCourseQuery không báo lỗi');
}

describe('parseCourseQuery', () => {
  it('Không truyền gì: không lọc, trang 1, 20 môn một trang', () => {
    expect(parseCourseQuery({})).toEqual({ q: '', page: 1, pageSize: 20 });
  });

  it('Đọc từ khóa (bỏ khoảng trắng hai đầu) và số trang', () => {
    expect(parseCourseQuery({ q: '  data ', page: '2', pageSize: '20' })).toEqual({
      q: 'data',
      page: 2,
      pageSize: 20,
    });
  });

  it('pageSize nhận đúng hai biên 1 và 100', () => {
    expect(parseCourseQuery({ pageSize: '1' }).pageSize).toBe(1);
    expect(parseCourseQuery({ pageSize: '100' }).pageSize).toBe(100);
  });

  it('page nhỏ hơn 1 hoặc không phải số nguyên thì báo lỗi page', () => {
    expect(invalidFields({ page: '0' })).toEqual(['page']);
    expect(invalidFields({ page: '1.5' })).toEqual(['page']);
    expect(invalidFields({ page: '' })).toEqual(['page']);
  });

  it('pageSize ngoài 1..100 hoặc không phải số thì báo lỗi pageSize', () => {
    expect(invalidFields({ pageSize: '101' })).toEqual(['pageSize']);
    expect(invalidFields({ pageSize: 'abc' })).toEqual(['pageSize']);
  });

  it('q truyền hai lần (?q=a&q=b) thì báo lỗi q', () => {
    expect(invalidFields({ q: ['a', 'b'] })).toEqual(['q']);
  });

  it('Nhiều tham số sai thì báo đủ trong một lần', () => {
    const error = (() => {
      try {
        return parseCourseQuery({ page: '0', pageSize: '500' });
      } catch (e) {
        return e as AppError;
      }
    })() as AppError;
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(Object.keys(error.details?.fields as object)).toEqual(['page', 'pageSize']);
  });
});

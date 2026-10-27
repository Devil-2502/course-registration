import { AppError } from '../src/common/app-error';
import { parseRegistrationRequest } from '../src/registration/registration-request';

describe('parseRegistrationRequest', () => {
  it('Đọc sectionId là số nguyên dương', () => {
    expect(parseRegistrationRequest({ sectionId: 22 })).toEqual({ sectionId: 22 });
  });

  it('Bỏ qua các trường thừa', () => {
    expect(parseRegistrationRequest({ sectionId: 5, note: 'x' })).toEqual({ sectionId: 5 });
  });

  it.each([
    ['thiếu sectionId', {}],
    ['sectionId là chuỗi', { sectionId: '22' }],
    ['sectionId bằng 0', { sectionId: 0 }],
    ['sectionId âm', { sectionId: -1 }],
    ['sectionId số thập phân', { sectionId: 1.5 }],
    ['body rỗng', undefined],
    ['body null', null],
    ['body là mảng', [22]],
  ])('%s: 400 VALIDATION_ERROR ở trường sectionId', (_name, body) => {
    try {
      parseRegistrationRequest(body);
      throw new Error('parseRegistrationRequest không báo lỗi');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
        details: { fields: { sectionId: 'must be a positive integer' } },
      });
    }
  });
});

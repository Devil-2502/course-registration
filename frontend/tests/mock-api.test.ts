import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api/api';

let mock: Api;
beforeEach(async () => {
  vi.resetModules();
  ({ mockApi: mock } = await import('../src/mocks/mockApi'));
});
afterEach(() => vi.unstubAllEnvs());

describe('API giả F2', () => {
  it('mô phỏng đăng nhập, sai mật khẩu, phiên hiện tại và đăng xuất', async () => {
    await expect(mock.me()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(mock.login('std_402@student.edu.vn', 'wrong')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(mock.login('std_402@student.edu.vn', 'Password@123')).resolves.toMatchObject({ role: 'STUDENT' });
    await expect(mock.me()).resolves.toMatchObject({ studentCode: 'std_402' });
    await mock.logout();
    await expect(mock.me()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('tìm mã hoặc tên, phân trang 45 môn và trả trạng thái tiên quyết', async () => {
    const { mockCourses } = await import('../src/mocks/data');
    mockCourses.push(...Array.from({ length: 40 }, (_, i) => ({ id: 100+i, code: `EX${i}`, name: `Môn ${i}`, credits: 3 })));
    expect((await mock.searchCourses('data', 1)).items[0].code).toBe('CS201');
    expect((await mock.searchCourses('CS201', 1)).items).toHaveLength(1);
    expect(await mock.searchCourses('zzzz', 1)).toMatchObject({ items: [], total: 0 });
    const second = await mock.searchCourses('', 2, 20);
    expect(second.items).toHaveLength(20);
    expect(second.total).toBe(45);
    expect((await mock.getCourse(2)).prerequisites[0]).toMatchObject({ code: 'CS101', passed: true });
    await expect(mock.getCourse(999999)).rejects.toMatchObject({ status: 404 });
  });

  it('xem trước xung đột, đăng ký lớp liền kề, từ chối trùng môn và hủy', async () => {
    const invalid = await mock.validateRegistration(2);
    expect(invalid.valid).toBe(false);
    expect(invalid.violations).toContainEqual(expect.objectContaining({ code: 'SCHEDULE_CLASH' }));
    await expect(mock.register(2)).rejects.toMatchObject({ code: 'SCHEDULE_CLASH' });
    expect((await mock.validateRegistration(3)).valid).toBe(true);
    const registration = await mock.register(3);
    expect(registration.section.remainingSeats).toBe(29);
    expect((await mock.mySchedule()).totalCredits).toBe(7);
    expect((await mock.myRegistrations()).some(item => item.id === registration.id)).toBe(true);
    await expect(mock.register(4)).rejects.toMatchObject({ code: 'ALREADY_ENROLLED' });
    await mock.drop(registration.id);
    expect((await mock.mySchedule()).totalCredits).toBe(3);
    expect((await mock.completedCourses())[0].passed).toBe(true);
  });

  it('vào và rời hàng chờ, từ chối vào hai lần hoặc lớp còn chỗ', async () => {
    await expect(mock.joinWaitlist(3)).rejects.toMatchObject({ code: 'SECTION_NOT_FULL' });
    const waiting = await mock.joinWaitlist(6);
    expect(waiting).toMatchObject({ position: 4, status: 'WAITING' });
    expect(await mock.myWaitlist()).toHaveLength(1);
    await expect(mock.joinWaitlist(6)).rejects.toMatchObject({ code: 'ALREADY_ON_WAITLIST' });
    await mock.leaveWaitlist(waiting.id);
    expect(await mock.myWaitlist()).toEqual([]);
  });

  it('mô phỏng quản lý môn, lớp, sức chứa và danh sách lớp', async () => {
    const input = { code: 'CS999', name: 'Môn mới', credits: 3 };
    const course = await mock.createCourse(input);
    await expect(mock.createCourse(input)).rejects.toMatchObject({ code: 'COURSE_CODE_EXISTS' });
    expect(await mock.updateCourse(course.id, { ...input, credits: 4 })).toMatchObject({ credits: 4 });
    const sectionInput = { courseId: course.id, semesterId: 2, code: 'CS999-01', capacity: 40, slots: [{ dayOfWeek: 2, startPeriod: 1, endPeriod: 3 }] };
    const section = await mock.createSection(sectionInput);
    expect(await mock.updateSection(section.id, { ...sectionInput, capacity: 45 })).toMatchObject({ capacity: 45 });
    await expect(mock.createSection(sectionInput)).rejects.toMatchObject({ code: 'SECTION_CODE_EXISTS' });
    await expect(mock.createSection({ ...sectionInput, code: 'CS999-02', slots: [{ dayOfWeek: 1, startPeriod: 5, endPeriod: 2 }] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(mock.updateSection(6, { ...sectionInput, capacity: 10 })).rejects.toMatchObject({ code: 'CAPACITY_BELOW_ENROLLED' });
    expect(await mock.sectionEnrolments(6)).toHaveLength(30);
    expect((await mock.sectionWaitlist(6)).map(item => item.studentCode)).toEqual(['std_610', 'std_611', 'std_170']);
  });

  it('thêm, gỡ tiên quyết và báo quan hệ trùng hoặc tạo vòng', async () => {
    await expect(mock.addPrerequisite(1, 3)).rejects.toMatchObject({ code: 'PREREQUISITE_CYCLE' });
    await expect(mock.addPrerequisite(2, 1)).rejects.toMatchObject({ code: 'PREREQUISITE_EXISTS' });
    expect(await mock.addPrerequisite(1, 13)).toContainEqual(expect.objectContaining({ code: 'MA101' }));
    await mock.removePrerequisite(1, 13);
    expect(await mock.listPrerequisites(1)).toEqual([]);
    await expect(mock.removePrerequisite(1, 13)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('chế độ giả không gọi HTTP, chế độ thật giữ đúng query và body', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    vi.stubEnv('VITE_USE_MOCK', 'true');
    vi.resetModules();
    const { api: fake } = await import('../src/api/api');
    await fake.searchCourses('CS201', 1);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv('VITE_USE_MOCK', 'false');
    vi.resetModules();
    const { api: real } = await import('../src/api/api');
    await real.searchCourses('data & algorithms', 2, 20);
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/courses?q=data+%26+algorithms&page=2&pageSize=20', expect.objectContaining({ credentials: 'include' }));
    await real.register(3);
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/registrations', expect.objectContaining({ method: 'POST', body: '{"sectionId":3}' }));
  });
});

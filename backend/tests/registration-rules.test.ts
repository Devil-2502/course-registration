import {
  collectViolations,
  firstViolation,
  RegistrationFacts,
} from '../src/registration/registration-rules';

// Một lần đăng ký hợp lệ; mỗi test chỉ đổi phần cần kiểm tra.
const ok: RegistrationFacts = {
  registrationOpen: true,
  enrolledInSameCourse: false,
  alreadyPassed: false,
  missingPrerequisites: [],
  clashesWith: [],
  credit: { allowed: true, currentCredits: 3, requestedCredits: 4, limit: 24 },
  remainingSeats: 5,
};
const facts = (patch: Partial<RegistrationFacts>): RegistrationFacts => ({ ...ok, ...patch });
const codes = (f: RegistrationFacts) => collectViolations(f).map((v) => v.code);

describe('collectViolations và firstViolation', () => {
  it('Đủ mọi điều kiện thì không có vi phạm nào', () => {
    expect(collectViolations(ok)).toEqual([]);
    expect(firstViolation(ok)).toBeNull();
  });

  it('Hết thời gian đăng ký: 403 REGISTRATION_CLOSED', () => {
    expect(firstViolation(facts({ registrationOpen: false }))).toMatchObject({
      code: 'REGISTRATION_CLOSED',
      status: 403,
    });
  });

  it('Đã có lớp khác của cùng môn: 409 ALREADY_ENROLLED', () => {
    expect(firstViolation(facts({ enrolledInSameCourse: true }))).toMatchObject({
      code: 'ALREADY_ENROLLED',
      status: 409,
    });
  });

  it('Đã đạt môn này: 422 COURSE_ALREADY_PASSED', () => {
    expect(firstViolation(facts({ alreadyPassed: true }))).toMatchObject({
      code: 'COURSE_ALREADY_PASSED',
      status: 422,
    });
  });

  it('Thiếu tiên quyết: 422, details.missingCourses có CS101', () => {
    const violation = firstViolation(facts({ missingPrerequisites: [{ id: 1, code: 'CS101' }] }));
    expect(violation).toMatchObject({ code: 'PREREQUISITE_NOT_MET', status: 422 });
    expect(violation?.details).toEqual({ missingCourses: [{ id: 1, code: 'CS101' }] });
  });

  it('Trùng lịch: 409, message đúng câu Gherkin "Schedule clash with MA101-01"', () => {
    const clashesWith = [{ sectionId: 11, sectionCode: 'MA101-01' }];
    const violation = firstViolation(facts({ clashesWith }));
    expect(violation).toMatchObject({ code: 'SCHEDULE_CLASH', status: 409 });
    expect(violation?.message).toBe('Schedule clash with MA101-01');
    expect(violation?.details).toEqual({ conflictsWith: clashesWith });
  });

  it('Trùng nhiều lớp thì liệt kê đủ trong message', () => {
    const clashesWith = [
      { sectionId: 11, sectionCode: 'MA101-01' },
      { sectionId: 22, sectionCode: 'CS201-02' },
    ];
    expect(firstViolation(facts({ clashesWith }))?.message).toBe(
      'Schedule clash with MA101-01, CS201-02',
    );
  });

  it('Vượt tín chỉ: 422, details có currentCredits, requestedCredits, limit', () => {
    const credit = { allowed: false, currentCredits: 22, requestedCredits: 4, limit: 24 };
    const violation = firstViolation(facts({ credit }));
    expect(violation).toMatchObject({ code: 'CREDIT_LIMIT_EXCEEDED', status: 422 });
    expect(violation?.details).toEqual({ currentCredits: 22, requestedCredits: 4, limit: 24 });
  });

  it('Lớp hết chỗ: 409 SECTION_FULL', () => {
    expect(firstViolation(facts({ remainingSeats: 0 }))).toMatchObject({
      code: 'SECTION_FULL',
      status: 409,
    });
  });

  it('Nhiều vi phạm thì trả theo đúng thứ tự bước 4 đến 10', () => {
    const all = facts({
      registrationOpen: false,
      enrolledInSameCourse: true,
      alreadyPassed: true,
      missingPrerequisites: [{ id: 1, code: 'CS101' }],
      clashesWith: [{ sectionId: 11, sectionCode: 'MA101-01' }],
      credit: { allowed: false, currentCredits: 22, requestedCredits: 4, limit: 24 },
      remainingSeats: 0,
    });
    expect(codes(all)).toEqual([
      'REGISTRATION_CLOSED',
      'ALREADY_ENROLLED',
      'COURSE_ALREADY_PASSED',
      'PREREQUISITE_NOT_MET',
      'SCHEDULE_CLASH',
      'CREDIT_LIMIT_EXCEEDED',
      'SECTION_FULL',
    ]);
  });

  it('Lớp đầy nhưng thiếu tiên quyết: lỗi đầu tiên là tiên quyết, vì kiểm tra chỗ trống chạy cuối', () => {
    const f = facts({ missingPrerequisites: [{ id: 1, code: 'CS101' }], remainingSeats: 0 });
    expect(firstViolation(f)?.code).toBe('PREREQUISITE_NOT_MET');
    expect(codes(f)).toEqual(['PREREQUISITE_NOT_MET', 'SECTION_FULL']);
  });
});
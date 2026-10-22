import { checkJoinWaitlist, WaitlistFacts } from '../src/waitlist/waitlist-rules';

// Gherkin US-09 "Join the waitlist": CS201-01 đã đầy, std_402 đã đạt CS101.
const ok: WaitlistFacts = {
  registrationOpen: true,
  enrolledInSameCourse: false,
  alreadyWaiting: false,
  missingPrerequisites: [],
  remainingSeats: 0,
};
const facts = (patch: Partial<WaitlistFacts>): WaitlistFacts => ({ ...ok, ...patch });

describe('checkJoinWaitlist', () => {
  it('Lớp đã đầy và đủ điều kiện thì được vào hàng chờ', () => {
    expect(checkJoinWaitlist(ok)).toBeNull();
  });

  it('Hết thời gian đăng ký: 403 REGISTRATION_CLOSED', () => {
    expect(checkJoinWaitlist(facts({ registrationOpen: false }))).toMatchObject({
      code: 'REGISTRATION_CLOSED',
      status: 403,
    });
  });

  it('Đang học một lớp của môn này: 409 ALREADY_ENROLLED', () => {
    expect(checkJoinWaitlist(facts({ enrolledInSameCourse: true }))).toMatchObject({
      code: 'ALREADY_ENROLLED',
      status: 409,
    });
  });

  it('Gherkin "Join the same waitlist twice": 409 ALREADY_ON_WAITLIST', () => {
    expect(checkJoinWaitlist(facts({ alreadyWaiting: true }))).toMatchObject({
      code: 'ALREADY_ON_WAITLIST',
      status: 409,
    });
  });

  it('Thiếu môn tiên quyết: 422 PREREQUISITE_NOT_MET kèm danh sách môn thiếu', () => {
    const missing = [{ id: 1, code: 'CS101', name: 'Introduction to Programming' }];
    expect(checkJoinWaitlist(facts({ missingPrerequisites: missing }))).toEqual({
      code: 'PREREQUISITE_NOT_MET',
      status: 422,
      message: 'Missing prerequisites: CS101.',
      details: { missingCourses: missing },
    });
  });

  it('Gherkin "Section still has seats": còn 3 chỗ thì 409 SECTION_NOT_FULL', () => {
    expect(checkJoinWaitlist(facts({ remainingSeats: 3 }))).toEqual({
      code: 'SECTION_NOT_FULL',
      status: 409,
      message: 'This section still has seats. Register for it directly.',
      details: { remainingSeats: 3 },
    });
  });

  it('Có nhiều lỗi cùng lúc thì trả lỗi đứng trước theo thứ tự', () => {
    const many = facts({
      registrationOpen: false,
      alreadyWaiting: true,
      missingPrerequisites: [{ id: 1, code: 'CS101' }],
      remainingSeats: 3,
    });
    expect(checkJoinWaitlist(many)?.code).toBe('REGISTRATION_CLOSED');
    expect(checkJoinWaitlist({ ...many, registrationOpen: true })?.code).toBe(
      'ALREADY_ON_WAITLIST',
    );
    expect(
      checkJoinWaitlist({ ...many, registrationOpen: true, alreadyWaiting: false })?.code,
    ).toBe('PREREQUISITE_NOT_MET');
  });
});
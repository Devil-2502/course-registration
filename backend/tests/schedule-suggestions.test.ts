import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/common/error-handler';
import {
  buildSuggestions,
  createSuggestionsRouter,
  type SuggestedSection,
  type SuggestionData,
  type SuggestionDataReader,
} from '../src/suggestions/schedule-suggestions';
import { parseSuggestionRequest } from '../src/suggestions/suggestion-request';

function section(
  id: number,
  code: string,
  courseId: number,
  slot: [number, number, number],
  remainingSeats = 10,
  credits = 4,
): SuggestedSection {
  const [dayOfWeek, startPeriod, endPeriod] = slot;
  return {
    sectionId: id,
    sectionCode: code,
    courseId,
    courseCode: code.slice(0, 5),
    courseName: code.slice(0, 5),
    credits,
    remainingSeats,
    slots: [{ dayOfWeek, startPeriod, endPeriod, room: null }],
  };
}

// Giống dữ liệu mẫu: std_402 đã đạt CS101, đang học MA101-01 (thứ Hai tiết 1-3).
function sampleData(): SuggestionData {
  return {
    semesterId: 2,
    maxCredits: 24,
    courses: [
      { id: 1, code: 'CS101', name: 'Intro', credits: 4 },
      { id: 2, code: 'CS201', name: 'DSA', credits: 4 },
      { id: 3, code: 'CS301', name: 'Algo', credits: 4 },
      { id: 4, code: 'EN101', name: 'English', credits: 2 },
      { id: 5, code: 'MA101', name: 'Calculus', credits: 3 },
      { id: 6, code: 'CS220', name: 'Arch', credits: 3 },
      { id: 7, code: 'PE101', name: 'PE', credits: 1 },
    ],
    passedCourseIds: [1],
    prerequisites: [
      { courseId: 2, prerequisite: { id: 1, code: 'CS101', name: 'Intro' } },
      { courseId: 3, prerequisite: { id: 2, code: 'CS201', name: 'DSA' } },
    ],
    enrolled: [section(11, 'MA101-01', 5, [1, 1, 3], 5, 3)],
    sections: [
      section(21, 'CS201-01', 2, [1, 2, 4]),
      section(22, 'CS201-02', 2, [1, 4, 6]),
      section(23, 'CS201-03', 2, [2, 1, 3]),
      section(41, 'EN101-01', 4, [3, 4, 5], 0, 2),
      section(61, 'CS220-01', 6, [1, 2, 3], 10, 3),
      section(71, 'PE101-01', 7, [7, 1, 2], 10, 1),
    ],
  };
}

const parse = (courseIds: number[], extra: Record<string, unknown> = {}) =>
  parseSuggestionRequest({ courseIds, ...extra });

describe('parseSuggestionRequest', () => {
  it('đặt giá trị mặc định, bỏ id trùng và sắp ngày nghỉ', () => {
    expect(
      parseSuggestionRequest({ courseIds: [2, 7, 2], preferences: { freeDays: [6, 1, 6] } }),
    ).toEqual({
      courseIds: [2, 7],
      preferences: { avoidMorning: false, compactDays: false, freeDays: [1, 6] },
      limit: 5,
    });
  });

  it.each([
    [{}, 'courseIds'],
    [{ courseIds: [] }, 'courseIds'],
    [{ courseIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, 'courseIds'],
    [{ courseIds: ['2'] }, 'courseIds'],
    [{ courseIds: [2], preferences: [] }, 'preferences'],
    [{ courseIds: [2], preferences: { avoidMorning: 'yes' } }, 'preferences.avoidMorning'],
    [{ courseIds: [2], preferences: { freeDays: [8] } }, 'preferences.freeDays'],
    [{ courseIds: [2], limit: 11 }, 'limit'],
  ])('từ chối %j (lỗi ở %s)', (body, field) => {
    expect(() => parseSuggestionRequest(body)).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: { fields: expect.objectContaining({ [field]: expect.any(String) }) },
      }),
    );
  });

  it('body không phải object vẫn báo lỗi courseIds', () => {
    expect(() => parseSuggestionRequest(null)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});

describe('buildSuggestions', () => {
  it('xếp lịch các môn đủ điều kiện, bỏ lớp trùng lớp đang học', () => {
    const result = buildSuggestions(sampleData(), parse([2, 7]));
    expect(result.courses.map((c) => [c.course.code, c.status])).toEqual([
      ['CS201', 'INCLUDED'],
      ['PE101', 'INCLUDED'],
    ]);
    expect(result.totalCombinations).toBe(2);
    expect(result.suggestions.map((s) => s.sections.map((x) => x.sectionCode))).toEqual([
      ['CS201-02', 'PE101-01'],
      ['CS201-03', 'PE101-01'],
    ]);
    expect(result.suggestions[0].rank).toBe(1);
    expect(result).toMatchObject({
      currentCredits: 3,
      requestedCredits: 5,
      exceedsCreditLimit: false,
      enrolled: [expect.objectContaining({ sectionCode: 'MA101-01' })],
    });
  });

  it('ghi rõ lý do từng môn bị loại', () => {
    const result = buildSuggestions(sampleData(), parse([5, 1, 3, 4, 6]));
    expect(result.courses.map((c) => c.status)).toEqual([
      'ALREADY_ENROLLED',
      'COURSE_ALREADY_PASSED',
      'PREREQUISITE_NOT_MET',
      'NO_AVAILABLE_SECTION',
      'CLASHES_WITH_ENROLLED',
    ]);
    expect(result.courses[2].missingCourses).toEqual([{ id: 2, code: 'CS201', name: 'DSA' }]);
    expect(result.suggestions).toEqual([]);
    expect(result.requestedCredits).toBe(0);
  });

  it('báo vượt giới hạn tín chỉ nhưng vẫn gợi ý', () => {
    const data = { ...sampleData(), maxCredits: 6 };
    const result = buildSuggestions(data, parse([2]));
    expect(result.exceedsCreditLimit).toBe(true);
    expect(result.suggestions).toHaveLength(2);
  });

  it('môn không tồn tại: 404', () => {
    expect(() => buildSuggestions(sampleData(), parse([99]))).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND', status: 404 }),
    );
  });
});

describe('POST /schedule-suggestions', () => {
  function appWith(data: SuggestionData | null) {
    const reader: SuggestionDataReader = { read: jest.fn().mockResolvedValue(data) };
    const app = express();
    app.use(express.json());
    app.use(
      '/schedule-suggestions',
      createSuggestionsRouter(reader, () => 402),
    );
    app.use(errorHandler);
    return { app, reader };
  }

  it('200 kèm các phương án, đọc dữ liệu theo sinh viên đang đăng nhập', async () => {
    const { app, reader } = appWith(sampleData());
    const response = await request(app)
      .post('/schedule-suggestions')
      .send({ courseIds: [2], preferences: { freeDays: [2] } });
    expect(response.status).toBe(200);
    expect(reader.read).toHaveBeenCalledWith(402, [2]);
    // Muốn nghỉ thứ Ba: CS201-03 (thứ Ba) bị đẩy xuống sau CS201-02.
    expect(response.body.suggestions[0].sections[0].sectionCode).toBe('CS201-02');
    expect(response.body.suggestions[1].metrics.busyFreeDays).toEqual([2]);
  });

  it('400 khi body sai', async () => {
    const { app, reader } = appWith(sampleData());
    const response = await request(app).post('/schedule-suggestions').send({ courseIds: 'CS201' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('404 khi chưa có học kỳ', async () => {
    const { app } = appWith(null);
    const response = await request(app)
      .post('/schedule-suggestions')
      .send({ courseIds: [2] });
    expect(response.status).toBe(404);
  });
});

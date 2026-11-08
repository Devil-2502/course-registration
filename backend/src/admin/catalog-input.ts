import { validationError } from '../common/app-error';
import { isNonEmptyString, isPositiveInteger } from '../common/validation';
import type { ScheduleSlot } from '../courses/courses.types';

// Body của POST /courses và PUT /courses/{id} (schema CourseInput).
export interface CourseInput {
  code: string;
  name: string;
  credits: number;
  description: string | null;
}

// Body của POST /sections và PUT /sections/{id} (schema SectionInput).
export interface SectionInput {
  courseId: number;
  semesterId: number;
  code: string;
  lecturerName: string | null;
  capacity: number;
  slots: ScheduleSlot[];
}

function asObject(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

// Chuỗi bắt buộc, cắt khoảng trắng hai đầu, không dài quá cột trong CSDL.
function readText(
  value: unknown,
  name: string,
  maxLength: number,
  fields: Record<string, string>,
): string {
  if (!isNonEmptyString(value)) {
    fields[name] = 'is required';
    return '';
  }
  if (value.trim().length > maxLength) fields[name] = `must be at most ${maxLength} characters`;
  return value.trim();
}

// Chuỗi không bắt buộc: thiếu, null hoặc rỗng đều thành null.
function readOptionalText(
  value: unknown,
  name: string,
  maxLength: number,
  fields: Record<string, string>,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    fields[name] = 'must be a string';
    return null;
  }
  if (value.trim().length > maxLength) fields[name] = `must be at most ${maxLength} characters`;
  return value.trim() === '' ? null : value.trim();
}

function readPositiveInteger(value: unknown, name: string, fields: Record<string, string>) {
  if (!isPositiveInteger(value)) fields[name] = 'must be a positive integer';
  return value as number;
}

// Mã môn và mã lớp lưu chữ hoa để "cs201" và "CS201" là cùng một mã.
export function parseCourseInput(body: unknown): CourseInput {
  const input = asObject(body);
  const fields: Record<string, string> = {};
  const course: CourseInput = {
    code: readText(input.code, 'code', 20, fields).toUpperCase(),
    name: readText(input.name, 'name', 200, fields),
    credits: readPositiveInteger(input.credits, 'credits', fields),
    description: readOptionalText(input.description, 'description', 2000, fields),
  };
  if (Object.keys(fields).length > 0) throw validationError(fields);
  return course;
}

function isPeriod(value: unknown): value is number {
  return isPositiveInteger(value) && value <= 15;
}

// Một buổi học: thứ 1-7 (1 là thứ Hai), tiết 1-15, tiết kết thúc không nhỏ hơn tiết bắt đầu.
function readSlot(value: unknown, index: number, fields: Record<string, string>): ScheduleSlot {
  const slot = asObject(value);
  const name = `slots[${index}]`;
  const { dayOfWeek, startPeriod, endPeriod } = slot;
  if (!isPositiveInteger(dayOfWeek) || dayOfWeek > 7) {
    fields[`${name}.dayOfWeek`] = 'must be an integer from 1 to 7';
  }
  if (!isPeriod(startPeriod)) fields[`${name}.startPeriod`] = 'must be an integer from 1 to 15';
  if (!isPeriod(endPeriod)) fields[`${name}.endPeriod`] = 'must be an integer from 1 to 15';
  if (isPeriod(startPeriod) && isPeriod(endPeriod) && endPeriod < startPeriod) {
    fields[`${name}.endPeriod`] = 'must not be lower than startPeriod';
  }
  return {
    dayOfWeek: dayOfWeek as number,
    startPeriod: startPeriod as number,
    endPeriod: endPeriod as number,
    room: readOptionalText(slot.room, `${name}.room`, 50, fields),
  };
}

// Hai buổi của cùng một lớp không được chồng giờ nhau.
function findOverlap(slots: ScheduleSlot[]): number {
  return slots.findIndex((a, i) =>
    slots.some(
      (b, j) =>
        j < i &&
        a.dayOfWeek === b.dayOfWeek &&
        a.startPeriod <= b.endPeriod &&
        b.startPeriod <= a.endPeriod,
    ),
  );
}

export function parseSectionInput(body: unknown): SectionInput {
  const input = asObject(body);
  const fields: Record<string, string> = {};
  const slots = Array.isArray(input.slots)
    ? input.slots.map((slot, index) => readSlot(slot, index, fields))
    : [];
  if (!Array.isArray(input.slots) || slots.length === 0) {
    fields.slots = 'must contain at least one slot';
  }
  const section: SectionInput = {
    courseId: readPositiveInteger(input.courseId, 'courseId', fields),
    semesterId: readPositiveInteger(input.semesterId, 'semesterId', fields),
    code: readText(input.code, 'code', 30, fields).toUpperCase(),
    lecturerName: readOptionalText(input.lecturerName, 'lecturerName', 200, fields),
    capacity: readPositiveInteger(input.capacity, 'capacity', fields),
    slots,
  };
  if (Object.keys(fields).length === 0) {
    const overlap = findOverlap(slots);
    if (overlap !== -1) fields[`slots[${overlap}]`] = 'overlaps another slot of this section';
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);
  return section;
}

// Body của POST /courses/{id}/prerequisites (schema PrerequisiteInput).
export function parsePrerequisiteInput(body: unknown): { prerequisiteId: number } {
  const { prerequisiteId } = asObject(body);
  if (!isPositiveInteger(prerequisiteId)) {
    throw validationError({ prerequisiteId: 'must be a positive integer' });
  }
  return { prerequisiteId };
}

import { validationError } from '../common/app-error';
import { isPositiveInteger } from '../common/validation';
import type { Preferences } from './schedule-suggester';

export const MAX_COURSES = 8;
export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;

// Body của POST /schedule-suggestions (schema ScheduleSuggestionRequest).
export interface SuggestionRequest {
  courseIds: number[];
  preferences: Preferences;
  limit: number;
}

function isDay(value: unknown): value is number {
  return isPositiveInteger(value) && value <= 7;
}

export function parseSuggestionRequest(body: unknown): SuggestionRequest {
  const input =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};

  const { courseIds } = input;
  if (
    !Array.isArray(courseIds) ||
    courseIds.length === 0 ||
    courseIds.length > MAX_COURSES ||
    !courseIds.every(isPositiveInteger)
  ) {
    errors.courseIds = `must be an array of 1 to ${MAX_COURSES} positive integers`;
  }

  const raw = input.preferences ?? {};
  const preferences =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!preferences) {
    errors.preferences = 'must be an object';
  } else {
    for (const key of ['avoidMorning', 'compactDays'] as const) {
      if (preferences[key] !== undefined && typeof preferences[key] !== 'boolean') {
        errors[`preferences.${key}`] = 'must be a boolean';
      }
    }
    const { freeDays } = preferences;
    if (freeDays !== undefined && (!Array.isArray(freeDays) || !freeDays.every(isDay))) {
      errors['preferences.freeDays'] = 'must be an array of days from 1 to 7';
    }
  }

  const { limit } = input;
  if (limit !== undefined && (!isPositiveInteger(limit) || limit > MAX_LIMIT)) {
    errors.limit = `must be an integer from 1 to ${MAX_LIMIT}`;
  }

  if (Object.keys(errors).length > 0) throw validationError(errors);
  const prefs = preferences as Record<string, unknown>;
  return {
    // Bỏ id trùng nhưng giữ thứ tự sinh viên đã chọn.
    courseIds: [...new Set(courseIds as number[])],
    preferences: {
      avoidMorning: prefs.avoidMorning === true,
      compactDays: prefs.compactDays === true,
      freeDays: [...new Set((prefs.freeDays as number[] | undefined) ?? [])].sort((a, b) => a - b),
    },
    limit: (limit as number | undefined) ?? DEFAULT_LIMIT,
  };
}

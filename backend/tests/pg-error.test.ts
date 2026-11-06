import { isUniqueViolation } from '../src/db/pg-error';

describe('isUniqueViolation', () => {
  it('returns true for PostgreSQL error 23505', () => {
    const error = { code: '23505' };

    expect(isUniqueViolation(error)).toBe(true);
  });

  it('returns false for other PostgreSQL errors', () => {
    const error = { code: '23503' };

    expect(isUniqueViolation(error)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isUniqueViolation('23505')).toBe(false);
  });

  it('returns false when code is missing', () => {
    expect(isUniqueViolation(new Error('Database error'))).toBe(false);
  });

  it('returns false when code is a number', () => {
    expect(isUniqueViolation({ code: 23505 })).toBe(false);
  });
});

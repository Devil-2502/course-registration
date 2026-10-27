import { pool } from '../src/db/pool';

import {
  createSession,
  findSessionUserId,
  deleteSession,
} from '../src/auth/auth.session';

jest.mock('../src/db/pool', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const mockQuery = pool.query as jest.Mock;

describe('Session Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Should create a session', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const sessionId = await createSession('1');

    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions'),
      [
        expect.stringMatching(/^[0-9a-f]{64}$/),
        '1',
        expect.any(Date),
      ],
    );

    // Không lưu session ID gốc trong database.
    const storedId = mockQuery.mock.calls[0][1][0];
    expect(storedId).not.toBe(sessionId);
  });

  test('Should find a valid session', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: '1' }],
    });

    const sessionId = 'a'.repeat(64);

    const userId = await findSessionUserId(sessionId);

    expect(userId).toBe('1');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test('Should reject an invalid session ID', async () => {
    const userId = await findSessionUserId('invalid');

    expect(userId).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('Should reject a session not found in database', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const userId = await findSessionUserId('a'.repeat(64));

    expect(userId).toBeNull();
  });

  test('Should delete a session', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await deleteSession('a'.repeat(64));

    expect(mockQuery).toHaveBeenCalledWith(
      'DELETE FROM sessions WHERE id = $1',
      [expect.stringMatching(/^[0-9a-f]{64}$/)],
    );
  });

  test('Should not delete an invalid session ID', async () => {
    await deleteSession('invalid');

    expect(mockQuery).not.toHaveBeenCalled();
  });
});
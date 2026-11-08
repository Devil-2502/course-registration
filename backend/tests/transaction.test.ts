import { pool } from '../src/db/pool';
import { withTransaction } from '../src/db/transaction';

jest.mock('../src/db/pool', () => ({
  pool: {
    connect: jest.fn(),
  },
}));

describe('withTransaction', () => {
  const mockQuery = jest.fn();
  const mockRelease = jest.fn();

  const mockConnect = pool.connect as jest.MockedFunction<() => Promise<import('pg').PoolClient>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery.mockResolvedValue({ rows: [] });

    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    } as unknown as import('pg').PoolClient);
  });

  it('commits when callback succeeds', async () => {
    const result = await withTransaction(async (client) => {
      await client.query('SELECT 1');
      return 'success';
    });

    expect(result).toBe('success');
    expect(mockQuery.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'SELECT 1', 'COMMIT']);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('rolls back when callback fails', async () => {
    const error = new Error('Database operation failed');

    await expect(
      withTransaction(async () => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(mockQuery.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('releases the client when COMMIT fails', async () => {
    const error = new Error('Commit failed');

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'COMMIT') throw error;
      return { rows: [] };
    });

    await expect(withTransaction(async () => 'success')).rejects.toBe(error);

    expect(mockQuery.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'COMMIT', 'ROLLBACK']);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('preserves the original error when ROLLBACK fails', async () => {
    const originalError = new Error('Original failure');

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') {
        throw new Error('Rollback failed');
      }
      return { rows: [] };
    });

    await expect(
      withTransaction(async () => {
        throw originalError;
      }),
    ).rejects.toBe(originalError);

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

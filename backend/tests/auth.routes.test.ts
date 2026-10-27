import request from 'supertest';
import { createApp } from '../src/app';
import { login } from '../src/auth/auth.service';
import { deleteSession } from '../src/auth/auth.session';

jest.mock('../src/auth/auth.service', () => ({
  login: jest.fn(),
}));
jest.mock('../src/auth/auth.session', () => ({
  SESSION_COOKIE_NAME: 'sid',
  SESSION_MAX_AGE_MS: 24 * 60 * 60 * 1000,
  findSessionUserId: jest.fn(),
  deleteSession: jest.fn(),
}));

const mockLogin = jest.mocked(login);

describe('Auth Routes - POST /api/v1/auth/login', () => {
  const app = createApp();
  test('Registrations without session returns 401', async () => {
  const response = await request(app)
    .get('/api/v1/registrations');

  expect(response.status).toBe(401);

  expect(response.body.code).toBe('UNAUTHENTICATED');
});

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('Successful login returns 200 and session cookie', async () => {
    mockLogin.mockResolvedValue({
      sessionId: 'test-session-id',
      user: {
        id: 1,
        email: 'std_402@student.edu.vn',
        fullName: 'Nguyen Van A',
        role: 'STUDENT',
        studentCode: '52400001',
      },
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'std_402@student.edu.vn',
        password: 'Student@123',
      });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('STUDENT');
    expect(response.body.email).toBe('std_402@student.edu.vn');

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('sid=test-session-id'),
      ]),
    );

    const cookieHeader = response.headers['set-cookie'][0];

    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
  });

  test('Missing password returns 400', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'std_402@student.edu.vn',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('Wrong password returns 401', async () => {
    const error = Object.assign(
      new Error('Invalid email or password.'),
      {
        code: 'INVALID_CREDENTIALS',
        status: 401,
      },
    );

    // Dùng AppError thật để kiểm tra error handler.
    const { AppError } = await import('../src/common/app-error');

    mockLogin.mockRejectedValue(
      new AppError(
        'INVALID_CREDENTIALS',
        401,
        error.message,
      ),
    );

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'std_402@student.edu.vn',
        password: 'WrongPassword',
      });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  describe('POST /api/v1/auth/logout', () => {
  const mockDeleteSession = jest.mocked(deleteSession);

  beforeEach(() => {
    mockDeleteSession.mockReset();
  });

  test('Logout with session cookie returns 204', async () => {
    mockDeleteSession.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'sid=test-session-id');

    expect(response.status).toBe(204);

    expect(mockDeleteSession).toHaveBeenCalledWith(
      'test-session-id',
    );

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('sid=;'),
      ]),
    );
  });

  test('Logout without cookie returns 204', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout');

    expect(response.status).toBe(204);

    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  test('Database error during logout returns 500', async () => {
    mockDeleteSession.mockRejectedValue(
      new Error('Database unavailable'),
    );

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'sid=test-session-id');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });
});
});


import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import {
  requireAuth,
  requireRole,
} from '../src/auth/auth.middleware';
import { findSessionUserId } from '../src/auth/auth.session';
import { findUserById } from '../src/auth/auth.repository';
import { errorHandler } from '../src/common/error-handler';

// Giả lập việc kiểm tra session.
jest.mock('../src/auth/auth.session', () => ({
  SESSION_COOKIE_NAME: 'sid',
  findSessionUserId: jest.fn(),
}));

// Giả lập việc tìm tài khoản trong PostgreSQL.
jest.mock('../src/auth/auth.repository', () => ({
  findUserById: jest.fn(),
}));

const mockFindSession = jest.mocked(findSessionUserId);
const mockFindUser = jest.mocked(findUserById);

describe('Authentication Middleware', () => {
  const app = express();

  app.use(cookieParser());

  app.get('/protected', requireAuth, (req, res) => {
    res.status(200).json({
      message: 'Access granted',
      userId: res.locals.userId,
      user: req.user,
    });
  });

 

  app.get(
  '/admin',
  requireAuth,
  requireRole('ADMIN'),
  (_req, res) => {
    res.status(200).json({
      message: 'Welcome Admin',
    });
  },
);

 app.use(errorHandler);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('No session cookie returns 401', async () => {
    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');

    expect(mockFindSession).not.toHaveBeenCalled();
    expect(mockFindUser).not.toHaveBeenCalled();
  });

  test('Invalid or expired session returns 401', async () => {
    mockFindSession.mockResolvedValue(null);

    const response = await request(app)
      .get('/protected')
      .set('Cookie', 'sid=invalid-session');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');

    expect(mockFindSession).toHaveBeenCalledWith(
      'invalid-session',
    );
    expect(mockFindUser).not.toHaveBeenCalled();
  });

  test('Valid session allows access', async () => {
    mockFindSession.mockResolvedValue('1');

    mockFindUser.mockResolvedValue({
      id: '1',
      email: 'std_402@student.edu.vn',
      password_hash: 'hashed-password',
      full_name: 'Test Student',
      role: 'STUDENT',
      student_id: '10',
      student_code: '402',
    });

    const response = await request(app)
      .get('/protected')
      .set('Cookie', 'sid=valid-session');

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      message: 'Access granted',
      userId: '1',
      user: {
        id: 1,
        email: 'std_402@student.edu.vn',
        fullName: 'Test Student',
        role: 'STUDENT',
        studentId: '10',
        studentCode: '402',
      },
    });

    expect(mockFindSession).toHaveBeenCalledWith(
      'valid-session',
    );
    expect(mockFindUser).toHaveBeenCalledWith('1');
  });

  test('Session belonging to a missing user returns 401', async () => {
    mockFindSession.mockResolvedValue('1');
    mockFindUser.mockResolvedValue(null);

    const response = await request(app)
      .get('/protected')
      .set('Cookie', 'sid=valid-session');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });
  
  test('Unauthenticated user cannot access admin route', async () => {
    const response = await request(app).get('/admin');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });

  test('STUDENT cannot access ADMIN route', async () => {
    mockFindSession.mockResolvedValue('1');

    mockFindUser.mockResolvedValue({
      id: '1',
      email: 'std_402@student.edu.vn',
      password_hash: 'hashed-password',
      full_name: 'Nguyen Van A',
      role: 'STUDENT',
      student_id: '10',
      student_code: '52400001',
    });

    const response = await request(app)
      .get('/admin')
      .set('Cookie', 'sid=student-session');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('ADMIN can access ADMIN route', async () => {
    mockFindSession.mockResolvedValue('2');

    mockFindUser.mockResolvedValue({
      id: '2',
      email: 'admin@student.edu.vn',
      password_hash: 'hashed-password',
      full_name: 'System Admin',
      role: 'ADMIN',
      student_id: null,
      student_code: null,
    });

    const response = await request(app)
      .get('/admin')
      .set('Cookie', 'sid=admin-session');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Welcome Admin',
    });
  });

});

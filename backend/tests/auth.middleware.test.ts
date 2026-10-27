import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import { requireAuth } from '../src/auth/auth.middleware';
import { findSessionUserId } from '../src/auth/auth.session';
import { errorHandler } from '../src/common/error-handler';

jest.mock('../src/auth/auth.session', () => ({
  SESSION_COOKIE_NAME: 'sid',
  findSessionUserId: jest.fn(),
}));

const mockFindSession = jest.mocked(findSessionUserId);

describe('Authentication Middleware', () => {
  const app = express();

  app.use(cookieParser());

  app.get('/protected', requireAuth, (_req, res) => {
    res.status(200).json({
      message: 'Access granted',
      userId: res.locals.userId,
    });
  });

  app.use(errorHandler);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('No session cookie returns 401', async () => {
    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');

    expect(mockFindSession).not.toHaveBeenCalled();
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
  });

  test('Valid session allows access', async () => {
    mockFindSession.mockResolvedValue('1');

    const response = await request(app)
      .get('/protected')
      .set('Cookie', 'sid=valid-session');

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      message: 'Access granted',
      userId: '1',
    });

    expect(mockFindSession).toHaveBeenCalledWith(
      'valid-session',
    );
  });
});
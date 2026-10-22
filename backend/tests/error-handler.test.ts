import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler, notFoundHandler } from '../src/common/error-handler';

let server: Server;
let baseUrl: string;

// App nhỏ chỉ để thử ba nhánh của middleware lỗi.
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post('/echo', (req, res) => {
    res.json(req.body);
  });
  app.get('/boom', () => {
    throw new Error('database is down');
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('notFoundHandler và errorHandler', () => {
  it('Đường dẫn không tồn tại: 404 NOT_FOUND', async () => {
    const response = await fetch(`${baseUrl}/abc`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: 'NOT_FOUND', message: 'Route not found.' });
  });

  it('Body không phải JSON hợp lệ: 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"sectionId": ',
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('VALIDATION_ERROR');
  });

  it('Lỗi không lường trước: 500 INTERNAL_ERROR, không lộ chi tiết lỗi cho client', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await fetch(`${baseUrl}/boom`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

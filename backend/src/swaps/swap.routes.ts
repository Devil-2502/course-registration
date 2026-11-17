import { Router } from 'express';
import { validationError } from '../common/app-error';
import { isPositiveInteger, parseId } from '../common/validation';
import type { StudentIdOf } from '../registration/registrations.routes';
import type { SwapStore } from './swap.repository';

// Body { toSectionId } của POST /swap-requests (schema SwapRequestInput).
export function parseSwapRequest(body: unknown): { toSectionId: number } {
  const toSectionId =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).toSectionId
      : undefined;
  if (!isPositiveInteger(toSectionId)) {
    throw validationError({ toSectionId: 'must be a positive integer' });
  }
  return { toSectionId };
}

// Gắn vào app tại /api/v1/swap-requests, sau requireAuth và requireRole('STUDENT').
export function createSwapRouter(store: SwapStore, studentIdOf: StudentIdOf) {
  const router = Router();

  // Xin đổi sang lớp khác của cùng môn: đổi chéo, chuyển thẳng, hoặc lưu lại chờ người đổi ngược.
  router.post('/', async (req, res) => {
    const { toSectionId } = parseSwapRequest(req.body);
    res.status(201).json(await store.request(studentIdOf(req), toSectionId));
  });

  // Các yêu cầu đổi lớp của sinh viên trong học kỳ hiện tại, mới nhất trước.
  router.get('/', async (req, res) => {
    res.json(await store.list(studentIdOf(req)));
  });

  // Hủy yêu cầu đang chờ.
  router.delete('/:requestId', async (req, res) => {
    await store.cancel(studentIdOf(req), parseId(req.params.requestId, 'requestId'));
    res.status(204).end();
  });

  return router;
}

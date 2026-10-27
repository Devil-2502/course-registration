import { validationError } from '../common/app-error';
import { isPositiveInteger } from '../common/validation';

// Body { sectionId } dùng chung cho POST /registrations, /registrations/validate và /waitlist
// (schema RegistrationRequest trong docs/openapi-spec.yaml).
export interface RegistrationRequest {
  sectionId: number;
}

export function parseRegistrationRequest(body: unknown): RegistrationRequest {
  const sectionId =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).sectionId
      : undefined;
  // Chỉ nhận số trong JSON, không nhận chuỗi "5", để frontend gửi đúng kiểu theo hợp đồng.
  if (!isPositiveInteger(sectionId)) {
    throw validationError({ sectionId: 'must be a positive integer' });
  }
  return { sectionId };
}

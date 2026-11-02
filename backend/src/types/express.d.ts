
import type { UserRole } from '../auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        fullName: string;
        role: UserRole;
        studentId: string | null;
        studentCode: string | null;
      };
    }
  }
}

export {};

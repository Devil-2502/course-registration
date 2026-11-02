import { AppError } from '../src/common/app-error';
import { login } from '../src/auth/auth.service';
import { findUserByEmail } from '../src/auth/auth.repository';
import { verifyPassword } from '../src/auth/auth.password';
import { createSession } from '../src/auth/auth.session';

jest.mock('../src/auth/auth.repository', () => ({
  findUserByEmail: jest.fn(),
}));

jest.mock('../src/auth/auth.password', () => ({
  verifyPassword: jest.fn(),
}));

jest.mock('../src/auth/auth.session', () => ({
  createSession: jest.fn(),
}));

const mockFindUser = jest.mocked(findUserByEmail);
const mockVerifyPassword = jest.mocked(verifyPassword);
const mockCreateSession = jest.mocked(createSession);

const student = {
  
  id: '1',
  email: 'std_402@student.edu.vn',
  password_hash: 'stored-hash',
  full_name: 'Nguyen Van A',
  role: 'STUDENT' as const,
  student_id: '1',
  student_code: '52400001',
};

describe('Auth Service - Student Login', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('Successful login creates a session', async () => {
    mockFindUser.mockResolvedValue(student);
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue('session-id');

    const result = await login({
      email: 'STD_402@STUDENT.EDU.VN',
      password: 'Student@123',
    });

    expect(mockFindUser).toHaveBeenCalledWith(
      'std_402@student.edu.vn',
    );

    expect(mockVerifyPassword).toHaveBeenCalledWith(
      'Student@123',
      'stored-hash',
    );

    expect(mockCreateSession).toHaveBeenCalledWith('1');

    expect(result).toEqual({
      sessionId: 'session-id',
      user: {
        id: 1,
        email: 'std_402@student.edu.vn',
        fullName: 'Nguyen Van A',
        role: 'STUDENT',
        studentCode: '52400001',
      },
    });
  });

  test('Wrong password returns 401', async () => {
    mockFindUser.mockResolvedValue(student);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(
      login({
        email: student.email,
        password: 'WrongPassword',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });

    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test('Unknown email returns 401', async () => {
    mockFindUser.mockResolvedValue(null);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(
      login({
        email: 'unknown@student.edu.vn',
        password: 'Student@123',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockVerifyPassword).toHaveBeenCalledTimes(1);
  });

  test('Unsafe user ID does not create a session', async () => {
    mockFindUser.mockResolvedValue({
      ...student,
      id: '9007199254740993',
    });

    mockVerifyPassword.mockResolvedValue(true);

    await expect(
      login({
        email: student.email,
        password: 'Student@123',
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
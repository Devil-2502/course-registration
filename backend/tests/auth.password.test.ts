import {
  hashPassword,
  verifyPassword,
} from '../src/auth/auth.password';

describe('Password Security', () => {
  test('Correct password should return true', async () => {
    const password = 'Student@123';

    const hashedPassword = await hashPassword(password);

    const result = await verifyPassword(
      password,
      hashedPassword,
    );

    expect(result).toBe(true);
  });

  test('Wrong password should return false', async () => {
    const hashedPassword = await hashPassword('Student@123');

    const result = await verifyPassword(
      'WrongPassword',
      hashedPassword,
    );

    expect(result).toBe(false);
  });

  test('Invalid hash should return false', async () => {
    const result = await verifyPassword(
      'Student@123',
      'invalid-hash',
    );

    expect(result).toBe(false);
  });
});
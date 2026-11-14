import { checkCreditLimit } from '../src/registration/credit-limit';

describe('US-07 - Credit Limit Verification', () => {
  // TC01: Tổng tín chỉ nhỏ hơn giới hạn
  it('Cho phép khi tổng tín chỉ nhỏ hơn giới hạn', () => {
    const result = checkCreditLimit(18, 3, 24);
    expect(result.allowed).toBe(true);
  });

  // TC02: Tổng tín chỉ bằng đúng giới hạn
  it('Cho phép khi tổng tín chỉ bằng giới hạn', () => {
    const result = checkCreditLimit(20, 4, 24);
    expect(result.allowed).toBe(true);
  });

  // TC03: Tổng tín chỉ vượt giới hạn
  it('Từ chối khi tổng tín chỉ vượt giới hạn', () => {
    const result = checkCreditLimit(22, 4, 24);
    expect(result.allowed).toBe(false);
  });

  // TC04: Chưa đăng ký tín chỉ nào
  it('Cho phép đăng ký khi chưa có tín chỉ', () => {
    const result = checkCreditLimit(0, 3, 24);
    expect(result.allowed).toBe(true);
  });

  // TC05: Môn mới có số tín chỉ vượt giới hạn
  it('Từ chối nếu riêng môn mới đã vượt giới hạn', () => {
    const result = checkCreditLimit(0, 25, 24);
    expect(result.allowed).toBe(false);
  });

  // TC06: Kiểm tra dữ liệu kết quả
  it('Trả về đầy đủ thông tin tín chỉ', () => {
    const result = checkCreditLimit(20, 4, 24);
    expect(result).toEqual({
      allowed: true,
      currentCredits: 20,
      requestedCredits: 4,
      limit: 24,
    });
  });

  // TC07: Giới hạn tùy theo học kỳ
  it('Sử dụng giới hạn tín chỉ của từng học kỳ', () => {
    expect(checkCreditLimit(18, 3, 20).allowed).toBe(false);
    expect(checkCreditLimit(18, 3, 24).allowed).toBe(true);
  });
});

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Tạm để mức cảnh báo: code cũ còn dấu "!", Bảo sẽ sửa trong PR refactor.
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      // Cho phép tham số bắt đầu bằng "_" không dùng tới (ví dụ next trong error handler của Express).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
    },
  },
);

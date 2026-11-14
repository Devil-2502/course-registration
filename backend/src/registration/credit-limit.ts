export interface CreditLimitResult {
  allowed: boolean;
  currentCredits: number;
  requestedCredits: number;
  limit: number;
}

export function checkCreditLimit(
  currentCredits: number,
  requestedCredits: number,
  limit: number,
): CreditLimitResult {
  return {
    allowed: currentCredits + requestedCredits <= limit,
    currentCredits,
    requestedCredits,
    limit,
  };
}

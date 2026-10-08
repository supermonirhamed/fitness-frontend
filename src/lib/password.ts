/** Mirrors the API's password policy (US-00.05); the breach check can only run on the server. */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 200

export interface PasswordProblems {
  password?: 'tooShort' | 'tooLong'
  confirmation?: 'mismatch'
}

export function passwordProblems(password: string, confirmation: string): PasswordProblems {
  const problems: PasswordProblems = {}
  if (password.length < PASSWORD_MIN) problems.password = 'tooShort'
  else if (password.length > PASSWORD_MAX) problems.password = 'tooLong'
  if (confirmation !== password) problems.confirmation = 'mismatch'
  return problems
}

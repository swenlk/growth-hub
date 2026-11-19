export type AccountFormState = {
  error: string | null;
  created: { email: string; temporaryPassword: string } | null;
};

export const emptyAccountFormState: AccountFormState = {
  error: null,
  created: null,
};

export function AccountCreated({
  email,
  temporaryPassword,
}: {
  email: string;
  temporaryPassword: string;
}) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm leading-6">
      <p>
        Give this temporary password to <span className="font-medium">{email}</span>. It is shown
        only this once. They use the same Sign in button, then choose a new password.
      </p>
      <p className="mt-2 font-mono text-base">{temporaryPassword}</p>
    </div>
  );
}

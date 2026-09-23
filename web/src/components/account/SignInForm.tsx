import { FormEvent, useState } from 'react';
import { LoaderCircle, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';

/** Magic-link email form shared by the account modal and signed-in-only pages. */
export function SignInForm({ inputId = 'account-email' }: { inputId?: string }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    await auth.sendMagicLink(email);
    setSending(false);
  };

  return <>
    <form className="mt-5 space-y-3" onSubmit={submitEmail}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-dim" htmlFor={inputId}>Email address</label>
      <input
        id={inputId}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-md border border-line bg-surface-0 px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        placeholder="you@example.com"
      />
      {/* !inline-flex: a legacy <=480px rule in index.css forces buttons to inline-block !important. */}
      <Button type="submit" className="w-full !inline-flex" disabled={sending || auth.loading}>
        {sending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <LogIn aria-hidden className="size-4" />}
        Email me a sign-in link
      </Button>
    </form>
    {auth.message && <p className="mt-3 rounded-md border border-positive/30 bg-positive-muted p-3 text-sm text-positive" role="status">{auth.message}</p>}
    {auth.error && <p className="mt-3 rounded-md border border-negative/30 bg-negative-muted p-3 text-sm text-negative" role="alert">{auth.error}</p>}
  </>;
}

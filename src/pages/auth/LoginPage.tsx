import { useState } from 'react';
import { Lock, Leaf } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSubmitting(true);
    setError('');

    const ok = await onLogin(username, password);
    setSubmitting(false);

    if (!ok) {
      setError('Invalid username or password, or login service is unavailable.');
      return;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-100 text-brand-700 mb-3">
            <Leaf size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LyvFlow Login</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to access your dashboard.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full justify-center py-2.5">
            <Lock size={16} /> {submitting ? 'Logging in...' : 'Log In'}
          </Button>
        </form>

        <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs text-gray-600">Credentials are validated server-side.</p>
          <p className="text-xs text-gray-500 mt-1">Set ADMIN_USERNAME and ADMIN_PASSWORD in Vercel Environment Variables.</p>
        </div>
      </Card>
    </div>
  );
}

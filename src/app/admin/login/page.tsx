'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState('admin');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lockedMinutes, setLockedMinutes] = React.useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          setLockedMinutes(data.minutesRemaining || 15);
        }
        setErrorMessage(data.error || 'Authentication failed');
        setIsLoading(false);
        return;
      }

      // Successful login
      router.push('/admin');
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-corporate-navy flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-sm bg-corporate-teal text-white flex items-center justify-center mx-auto shadow-md">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-white uppercase">
          Meeting Room Booking
        </h1>
        <p className="mt-1 text-xs text-slate-300 font-medium">
          Receptionist Administration Console
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-sm border border-slate-200 sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-corporate-red text-xs rounded-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Authentication Error</p>
                  <p className="mt-0.5 text-slate-700">{errorMessage}</p>
                  {lockedMinutes !== null && (
                    <p className="mt-1 font-bold text-corporate-red">
                      Account locked for security. Try again in {lockedMinutes} minutes.
                    </p>
                  )}
                </div>
              </div>
            )}

            <Input
              id="admin-username"
              label="Admin Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={lockedMinutes !== null}
            />

            <Input
              id="admin-password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={lockedMinutes !== null}
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full bg-corporate-navy hover:bg-[#071528] h-10"
                isLoading={isLoading}
                disabled={lockedMinutes !== null}
              >
                <Lock className="w-4 h-4 mr-2" />
                Authenticate to Console
              </Button>
            </div>
          </form>

          <div className="mt-6 border-t border-corporate-hairline pt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Single Admin System</span>
            <Link href="/" className="hover:text-corporate-navy flex items-center gap-1 font-medium">
              <ArrowLeft className="w-3 h-3" />
              Public Directory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

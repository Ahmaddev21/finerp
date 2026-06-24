import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, Building2, Shield, Users, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { login, signup } from '../services/auth';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

type AuthMode = 'login' | 'signup-create' | 'signup-join' | 'forgot-password';

const inputCls = 'w-full bg-slate-900/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-600';

export default function AuthPage() {
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    companyName: '',
    currency: 'QR',
    joinCode: '',
  });

  const switchMode = (next: AuthMode) => {
    setError('');
    setResetSent(false);
    setMode(next);
  };

  const friendlyError = (msg: string) => {
    if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
    if (msg.includes('User already registered')) return 'This email is already registered. Please sign in.';
    if (msg.includes('Invalid join code')) return 'The join code you entered is invalid or expired.';
    if (msg.includes('Password should be')) return 'Password must be at least 6 characters.';
    if (msg.includes('Email not confirmed')) return 'Please check your email to confirm your account.';
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (mode === 'login') {
        result = await login(form.email, form.password);
      } else {
        result = await signup(
          form.username,
          form.email,
          form.password,
          mode === 'signup-create' ? form.companyName : undefined,
          mode === 'signup-create' ? form.currency : undefined,
          mode === 'signup-join' ? form.joinCode : undefined
        );
      }

      setAuth(
        {
          id: result.user.id,
          email: result.user.email ?? '',
          role: result.role as any,
          name: result.profile.username,
        },
        result.profile,
        result.company ?? null
      );
    } catch (err: any) {
      setError(friendlyError(err.message || 'An unexpected error occurred.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}`,
      });
      if (err) throw err;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const headerIcon = () => {
    if (mode === 'signup-join') return <Users className="w-10 h-10 text-white" />;
    if (mode === 'forgot-password') return <Lock className="w-10 h-10 text-white" />;
    return <Building2 className="w-10 h-10 text-white" />;
  };

  const headerTitle = () => {
    if (mode === 'login') return 'Welcome Back';
    if (mode === 'signup-create') return 'Create Company';
    if (mode === 'signup-join') return 'Join Team';
    return 'Reset Password';
  };

  const headerSub = () => {
    if (mode === 'login') return 'Sign in to your FinERP dashboard';
    if (mode === 'signup-create') return 'Initialize your financial command center';
    if (mode === 'signup-join') return 'Enter your invite code to collaborate with your team';
    return 'Enter your email and we\'ll send a reset link';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-blue-600 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] bg-emerald-600 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/20 transform rotate-3 hover:rotate-6 transition-transform duration-500">
            {headerIcon()}
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{headerTitle()}</h2>
          <p className="text-slate-400 text-sm">{headerSub()}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-300 text-sm">
            <Shield className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Forgot Password Flow ── */}
        {mode === 'forgot-password' ? (
          resetSent ? (
            <div className="text-center space-y-5">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
              <div>
                <p className="text-white font-semibold text-lg">Check your email</p>
                <p className="text-slate-400 text-sm mt-1">
                  A password reset link has been sent to<br />
                  <span className="text-blue-400 font-medium">{form.email}</span>
                </p>
              </div>
              <button
                onClick={() => switchMode('login')}
                className="text-slate-400 hover:text-white transition-colors text-sm"
              >
                ← Back to <span className="text-blue-400 font-medium">Sign In</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-400" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 mt-6 group active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send Reset Link <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>}
              </button>
              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-slate-400 hover:text-white transition-colors text-sm"
                >
                  ← Back to <span className="text-blue-400 font-medium">Sign In</span>
                </button>
              </div>
            </form>
          )
        ) : (
          /* ── Login / Signup Flow ── */
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== 'login' && (
                <>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-400" />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value })}
                      className={inputCls}
                      required
                    />
                  </div>

                  {mode === 'signup-create' ? (
                    <>
                      <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-400" />
                        <input
                          type="text"
                          placeholder="Company Name"
                          value={form.companyName}
                          onChange={e => setForm({ ...form, companyName: e.target.value })}
                          className={inputCls}
                          required
                        />
                      </div>
                      <select
                        value={form.currency}
                        onChange={e => setForm({ ...form, currency: e.target.value })}
                        className="w-full bg-slate-900/40 border border-white/10 rounded-xl py-3.5 px-4 text-white outline-none focus:ring-2 focus:ring-blue-500/40 transition-all appearance-none cursor-pointer"
                      >
                        <option value="QR">QR (﷼) — Qatari Riyal</option>
                        <option value="USD">USD ($) — US Dollar</option>
                        <option value="EUR">EUR (€) — Euro</option>
                        <option value="GBP">GBP (£) — British Pound</option>
                        <option value="AED">AED (د.إ) — UAE Dirham</option>
                        <option value="SAR">SAR (﷼) — Saudi Riyal</option>
                      </select>
                    </>
                  ) : (
                    <div className="relative group">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-400" />
                      <input
                        type="text"
                        placeholder="ENTER ACCESS CODE"
                        value={form.joinCode}
                        onChange={e => setForm({ ...form, joinCode: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-900/40 border-2 border-dashed border-blue-500/30 rounded-xl py-3.5 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500/40 transition-all tracking-[0.3em] font-mono text-center uppercase placeholder:text-slate-700 placeholder:tracking-normal"
                        required
                        maxLength={6}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Email */}
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-400" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>

              {/* Password */}
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className={inputCls.replace('pr-4', 'pr-12')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Forgot password link — login mode only */}
              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot-password')}
                    className="text-sm text-slate-500 hover:text-blue-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 flex items-center justify-center gap-3 mt-6 group active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : mode === 'signup-create' ? 'Create Company' : 'Join Team'}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Mode switcher */}
            <div className="mt-8 pt-6 border-t border-white/5 text-center flex flex-col gap-3">
              {mode === 'login' ? (
                <>
                  <button
                    onClick={() => switchMode('signup-create')}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    New here? <span className="text-blue-400 font-medium">Create a Company</span>
                  </button>
                  <button
                    onClick={() => switchMode('signup-join')}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Have a code? <span className="text-emerald-400 font-medium">Join a Team</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => switchMode('login')}
                  className="text-slate-400 hover:text-white transition-colors text-sm"
                >
                  Already have an account? <span className="text-blue-400 font-medium">Sign In</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

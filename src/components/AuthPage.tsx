import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, Building2, Shield, Users, CheckCircle2, Eye, EyeOff, BarChart3, FileText, Truck, Clock } from 'lucide-react';
import { login, signup } from '../services/auth';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';

type AuthMode = 'login' | 'signup-create' | 'signup-join' | 'forgot-password';

const inputCls = 'w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all placeholder:text-slate-400 text-sm';

const features = [
  { icon: BarChart3, label: 'Financial Dashboard',  desc: 'Real-time P&L, invoicing & ledger' },
  { icon: FileText,  label: 'Contracts & Workflow', desc: 'End-to-end document management'    },
  { icon: Truck,     label: 'Delivery Management',  desc: 'Fleet, riders & document tracking'  },
  { icon: Clock,     label: 'Time & Attendance',    desc: 'Shift tracking across all staff'    },
];

export default function AuthPage() {
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: '', email: '', password: '',
    companyName: '', currency: 'QR', joinCode: '',
  });

  const switchMode = (next: AuthMode) => { setError(''); setResetSent(false); setMode(next); };

  const friendlyError = (msg: string) => {
    if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
    if (msg.includes('User already registered'))   return 'This email is already registered. Please sign in.';
    if (msg.includes('Invalid join code'))          return 'The join code you entered is invalid or expired.';
    if (msg.includes('Password should be'))         return 'Password must be at least 6 characters.';
    if (msg.includes('Email not confirmed'))        return 'Please check your email to confirm your account.';
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      let result;
      if (mode === 'login') {
        result = await login(form.email, form.password);
      } else {
        result = await signup(
          form.username, form.email, form.password,
          mode === 'signup-create' ? form.companyName : undefined,
          mode === 'signup-create' ? form.currency    : undefined,
          mode === 'signup-join'   ? form.joinCode    : undefined
        );
      }
      setAuth(
        { id: result.user.id, email: result.user.email ?? '', role: result.role as any, name: result.profile.username },
        result.profile, result.company ?? null
      );
    } catch (err: any) {
      setError(friendlyError(err.message || 'An unexpected error occurred.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: window.location.origin });
      if (err) throw err;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── LEFT PANEL — branding ───────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col justify-between p-14 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">

        {/* Subtle texture blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-5%]  w-[50%] h-[50%] bg-blue-600/20   rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-indigo-500/20 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] left-[30%]   w-[30%] h-[30%] bg-violet-600/10  rounded-full blur-[80px]"  />
        </div>

        {/* Grid lines overlay — subtle */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />

        {/* Top — logo + company */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16">
            <img
              src="/logo-transparent.png"
              alt="Rafi Al Aftab"
              className="h-12 w-auto object-contain brightness-0 invert"
            />
            <div>
              <p className="text-white font-black text-xl tracking-tight leading-none">FinERP</p>
              <p className="text-blue-300 text-xs font-medium tracking-wider">RAFI AL AFTAB</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight mb-4">
            Your Business.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
              One Platform.
            </span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
            The complete financial &amp; operations system built for growing teams in Qatar.
          </p>
        </div>

        {/* Middle — feature pills */}
        <div className="relative z-10 space-y-3">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4 hover:bg-white/8 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{label}</p>
                <p className="text-slate-500 text-xs">{desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 ml-auto shrink-0" />
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© 2025 Rafi Al Aftab. All rights reserved.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ──────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <img src="/logo-transparent.png" alt="Rafi Al Aftab" className="h-9 w-auto object-contain" />
            <div>
              <p className="font-black text-slate-900 text-lg leading-none">FinERP</p>
              <p className="text-blue-600 text-[10px] font-bold tracking-wider">RAFI AL AFTAB</p>
            </div>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'login'          ? 'Sign in'          :
               mode === 'signup-create' ? 'Create company'   :
               mode === 'signup-join'   ? 'Join your team'   : 'Reset password'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {mode === 'login'          ? 'Welcome back — enter your credentials'       :
               mode === 'signup-create' ? 'Set up your company workspace'               :
               mode === 'signup-join'   ? 'Enter your invite code to get started'       :
                                          "We'll email you a secure reset link"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-600 text-sm">
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Forgot Password ── */}
          {mode === 'forgot-password' ? (
            resetSent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Check your inbox</p>
                  <p className="text-slate-500 text-sm mt-1">Reset link sent to <span className="text-blue-600 font-medium">{form.email}</span></p>
                </div>
                <button onClick={() => switchMode('login')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} required autoFocus />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm mt-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send reset link <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button type="button" onClick={() => switchMode('login')} className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-1">← Back to sign in</button>
              </form>
            )
          ) : (
            /* ── Login / Signup ── */
            <>
              <form onSubmit={handleSubmit} className="space-y-3">

                {mode !== 'login' && (
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="text" placeholder="Full name" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} required />
                  </div>
                )}

                {mode === 'signup-create' && (
                  <>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input type="text" placeholder="Company name" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} className={inputCls} required />
                    </div>
                    <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all appearance-none cursor-pointer">
                      <option value="QR">QR (﷼) — Qatari Riyal</option>
                      <option value="USD">USD ($) — US Dollar</option>
                      <option value="EUR">EUR (€) — Euro</option>
                      <option value="GBP">GBP (£) — British Pound</option>
                      <option value="AED">AED (د.إ) — UAE Dirham</option>
                      <option value="SAR">SAR (﷼) — Saudi Riyal</option>
                    </select>
                  </>
                )}

                {mode === 'signup-join' && (
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="INVITE CODE"
                      value={form.joinCode}
                      onChange={e => setForm({ ...form, joinCode: e.target.value.toUpperCase() })}
                      className="w-full bg-white border-2 border-dashed border-blue-300 rounded-xl py-3.5 pl-12 pr-4 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all tracking-[0.3em] font-mono text-center text-sm uppercase placeholder:text-slate-400 placeholder:tracking-normal"
                      required maxLength={6}
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} required />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={cn(inputCls, 'pr-12')} required />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === 'login' && (
                  <div className="text-right pt-0.5">
                    <button type="button" onClick={() => switchMode('forgot-password')} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      {mode === 'login' ? 'Sign in' : mode === 'signup-create' ? 'Create company' : 'Join team'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center"><span className="bg-slate-50 px-3 text-xs text-slate-400">or</span></div>
              </div>

              {/* Mode switcher */}
              <div className="space-y-2">
                {mode === 'login' ? (
                  <>
                    <button onClick={() => switchMode('signup-create')} className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-500" /> Create a new company
                    </button>
                    <button onClick={() => switchMode('signup-join')} className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" /> Join with invite code
                    </button>
                  </>
                ) : (
                  <button onClick={() => switchMode('login')} className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all">
                    Already have an account? Sign in
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

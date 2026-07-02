import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, Building2, Shield, Users, CheckCircle2, Eye, EyeOff, TrendingUp, Truck } from 'lucide-react';
import { login, signup } from '../services/auth';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';

type AuthMode = 'login' | 'signup-create' | 'signup-join' | 'forgot-password';

const inputCls = 'w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all placeholder:text-slate-400 text-sm shadow-sm';

/* ── 3-D Dashboard mockup (pure CSS) ─────────────────── */
function DashboardMockup() {
  return (
    <div className="relative w-full flex items-center justify-center py-6 select-none" style={{ perspective: '900px' }}>
      {/* Main card */}
      <div
        className="w-[340px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100"
        style={{ transform: 'rotateX(8deg) rotateY(-6deg) rotateZ(1deg)', transformStyle: 'preserve-3d' }}
      >
        {/* Card header */}
        <div className="bg-gradient-to-r from-[#2f3b9e] to-[#4a5bc7] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-transparent.png" alt="" className="h-5 w-auto brightness-0 invert opacity-90" />
            <span className="text-white text-xs font-bold tracking-wide">FinERP Dashboard</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-px bg-slate-100 border-b border-slate-100">
          {[
            { label: 'Revenue',  value: 'QR 84.2K', color: 'text-emerald-600', up: true  },
            { label: 'Expenses', value: 'QR 31.5K', color: 'text-rose-500',    up: false },
            { label: 'Profit',   value: 'QR 52.7K', color: 'text-blue-600',    up: true  },
          ].map(k => (
            <div key={k.label} className="bg-white px-3 py-3 text-center">
              <p className={cn('text-sm font-black tabular-nums', k.color)}>{k.value}</p>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{k.label}</p>
              <div className={cn('text-[9px] font-bold mt-0.5', k.up ? 'text-emerald-500' : 'text-rose-400')}>
                {k.up ? '▲ +12%' : '▼ -3%'}
              </div>
            </div>
          ))}
        </div>

        {/* Mini chart bars */}
        <div className="px-4 py-3 bg-white">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Monthly Overview</p>
          <div className="flex items-end gap-1.5 h-12">
            {[40, 65, 45, 80, 60, 90, 55, 75, 85, 70, 95, 72].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{
                height: `${h}%`,
                background: i === 10
                  ? 'linear-gradient(to top, #2f3b9e, #4a5bc7)'
                  : i >= 9 ? 'rgba(47,59,158,0.2)' : 'rgba(47,59,158,0.12)'
              }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
              <span key={m} className="text-[7px] text-slate-300 font-medium">{m.slice(0,1)}</span>
            ))}
          </div>
        </div>

        {/* Recent rows */}
        <div className="border-t border-slate-50 px-4 pb-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pt-2.5 mb-2">Recent Activity</p>
          {[
            { name: 'Invoice #1042', amount: '+QR 4,200', color: 'text-emerald-600' },
            { name: 'Delivery · DEL-829', amount: 'Active', color: 'text-blue-600' },
            { name: 'Contract · CTR-18',  amount: 'QR 12K', color: 'text-indigo-600' },
          ].map(r => (
            <div key={r.name} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-[10px] text-slate-600 font-medium">{r.name}</span>
              </div>
              <span className={cn('text-[10px] font-bold', r.color)}>{r.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating stat chip — top right */}
      <div
        className="absolute top-4 right-4 bg-white rounded-xl shadow-xl border border-slate-100 px-3 py-2 flex items-center gap-2"
        style={{ transform: 'rotateX(8deg) rotateY(-6deg) translateZ(20px)' }}
      >
        <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div>
          <p className="text-[9px] text-slate-400 font-semibold">Net Profit</p>
          <p className="text-xs font-black text-emerald-600">+24.8%</p>
        </div>
      </div>

      {/* Floating stat chip — bottom left */}
      <div
        className="absolute bottom-4 left-4 bg-white rounded-xl shadow-xl border border-slate-100 px-3 py-2 flex items-center gap-2"
        style={{ transform: 'rotateX(8deg) rotateY(-6deg) translateZ(20px)' }}
      >
        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
          <Truck className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <div>
          <p className="text-[9px] text-slate-400 font-semibold">Fleet Active</p>
          <p className="text-xs font-black text-blue-600">48 Riders</p>
        </div>
      </div>
    </div>
  );
}

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

      {/* ── LEFT PANEL ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #ffffff 0%, #f0f3ff 50%, #e8edff 100%)' }}
      >
        {/* Subtle decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-5%]  right-[-5%] w-72 h-72 bg-blue-100/60   rounded-full blur-[80px]"  />
          <div className="absolute bottom-[-5%] left-[-5%]  w-80 h-80 bg-indigo-100/50 rounded-full blur-[80px]"  />
          <div className="absolute top-[45%]  left-[40%]   w-48 h-48 bg-violet-100/40  rounded-full blur-[60px]"  />
        </div>

        <div className="relative z-10 flex flex-col h-full px-14 pt-12 pb-10">

          {/* ── Full Company Logo ── */}
          <div className="flex flex-col items-start gap-2 mb-8">
            {/* Icon mark on top */}
            <div className="w-[72px] h-[72px] rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center p-2.5 mb-1">
              <img src="/logo-transparent.png" alt="Rafi Al Aftab" className="w-full h-full object-contain" />
            </div>
            {/* Arabic name */}
            <p className="font-bold text-[#2f3b9e] text-[15px] leading-snug" dir="rtl" style={{ fontFamily: 'Arial, sans-serif' }}>
              رافي الافتاب للتجارة والمقاولات ذ.م.م
            </p>
            {/* English name */}
            <p className="text-[10.5px] font-black text-[#2f3b9e]/80 tracking-[0.06em] leading-snug uppercase">
              Rafi Al Aftab Trading &amp; Contracting Co. W.L.L
            </p>
          </div>

          {/* ── Headline + module list ── */}
          <div className="mb-6">
            <h1 className="text-4xl font-black text-slate-900 leading-[1.1] tracking-tight">
              Smart Operations.<br />
              <span className="text-[#2f3b9e]">One Platform.</span>
            </h1>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed max-w-sm">
              An all-in-one ERP for Rafi Al Aftab — managing delivery fleets, company finances,
              contracts, employee documents, and team attendance from a single workspace.
            </p>
            {/* Module chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { label: 'Delivery & Fleet' },
                { label: 'Finance & Invoicing' },
                { label: 'Contracts' },
                { label: 'Documents' },
                { label: 'Time & Attendance' },
              ].map(m => (
                <span key={m.label} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2f3b9e]/60 shrink-0" />
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── 3D Dashboard Mockup ── */}
          <div className="flex-1 flex items-center justify-center">
            <DashboardMockup />
          </div>

          {/* ── Footer ── */}
          <div className="pt-6 border-t border-slate-200/80 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              © 2025 Rafi Al Aftab Trading & Contracting Co. W.L.L
            </p>
            <p className="text-xs font-semibold text-slate-400">Qatar · All rights reserved</p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ──────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-2 mb-10">
            <img src="/logo-transparent.png" alt="Rafi Al Aftab" className="h-12 w-auto object-contain" />
            <p className="text-xs font-black text-[#2f3b9e] tracking-wide text-center uppercase">Rafi Al Aftab Trading & Contracting</p>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'login'          ? 'Welcome back'      :
               mode === 'signup-create' ? 'Create company'    :
               mode === 'signup-join'   ? 'Join your team'    : 'Reset password'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {mode === 'login'          ? 'Sign in to your FinERP workspace'          :
               mode === 'signup-create' ? 'Set up your company workspace'             :
               mode === 'signup-join'   ? 'Enter your invite code to get started'     :
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
                  <p className="text-slate-500 text-sm mt-1">Reset link sent to <span className="text-[#2f3b9e] font-medium">{form.email}</span></p>
                </div>
                <button onClick={() => switchMode('login')} className="text-sm text-slate-500 hover:text-[#2f3b9e] transition-colors">
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} required autoFocus />
                </div>
                <button type="submit" disabled={loading} className="w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm text-white active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #2f3b9e 0%, #4a5bc7 100%)' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send reset link <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button type="button" onClick={() => switchMode('login')} className="w-full text-sm text-slate-400 hover:text-slate-700 transition-colors py-1">← Back to sign in</button>
              </form>
            )
          ) : (
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
                    <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all appearance-none cursor-pointer shadow-sm">
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
                      type="text" placeholder="INVITE CODE"
                      value={form.joinCode} onChange={e => setForm({ ...form, joinCode: e.target.value.toUpperCase() })}
                      className="w-full bg-white border-2 border-dashed border-[#2f3b9e]/30 rounded-xl py-3.5 pl-12 pr-4 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all tracking-[0.3em] font-mono text-center text-sm uppercase placeholder:text-slate-400 placeholder:tracking-normal shadow-sm"
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
                  <div className="text-right">
                    <button type="button" onClick={() => switchMode('forgot-password')} className="text-xs text-slate-400 hover:text-[#2f3b9e] transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-1 active:scale-[0.98] shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #2f3b9e 0%, #4a5bc7 100%)', boxShadow: '0 8px 24px rgba(47,59,158,0.25)' }}
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
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">or continue with</span></div>
              </div>

              {/* Mode switcher */}
              <div className="space-y-2">
                {mode === 'login' ? (
                  <>
                    <button onClick={() => switchMode('signup-create')} className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                      <Building2 className="w-4 h-4 text-[#2f3b9e]" /> Create a new company
                    </button>
                    <button onClick={() => switchMode('signup-join')} className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" /> Join with invite code
                    </button>
                  </>
                ) : (
                  <button onClick={() => switchMode('login')} className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                    Already have an account? Sign in
                  </button>
                )}
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-8">
                Secured by Rafi Al Aftab Trading & Contracting Co. W.L.L
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

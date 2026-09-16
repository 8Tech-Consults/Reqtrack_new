import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuthContext } from '@/auth';
import { useLayout } from '@/providers';
import { toAbsoluteUrl } from '@/utils';

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Enter a valid email address')
    .min(3, 'Email is too short')
    .max(50, 'Email is too long')
    .required('Email is required'),
  password: Yup.string()
    .min(3, 'Password is too short')
    .max(50, 'Password is too long')
    .required('Password is required'),
  remember: Yup.boolean()
});

const initialValues = {
  email: '',
  password: '',
  remember: false
};

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, auth } = useAuthContext();
  const { currentLayout } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';
  const rememberedEmail = useMemo(() => localStorage.getItem('email') || '', []);
  const resetPasswordPath =
    currentLayout?.name === 'auth-branded'
      ? '/auth/reset-password'
      : '/auth/classic/reset-password';

  useEffect(() => {
    if (auth) {
      navigate(from, { replace: true });
    }
  }, [auth, from, navigate]);

  const formik = useFormik({
    initialValues: {
      ...initialValues,
      email: rememberedEmail,
      remember: Boolean(rememberedEmail)
    },
    validationSchema: loginSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);

      try {
        if (!login) {
          throw new Error('Sign in is temporarily unavailable.');
        }

        await login(values.email, values.password);

        if (values.remember) {
          localStorage.setItem('email', values.email);
        } else {
          localStorage.removeItem('email');
        }

        navigate(from, { replace: true });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Check your email and password.');
        setSubmitting(false);
      } finally {
        setLoading(false);
      }
    }
  });

  const togglePassword = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setShowPassword((visible) => !visible);
  };

  const fieldClass = (hasError: boolean) =>
    clsx(
      'group flex h-12 items-center gap-3 rounded-xl border bg-white/80 px-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus-within:bg-white focus-within:outline-none focus-within:ring-4',
      hasError
        ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100'
        : 'border-slate-200 hover:border-slate-300 focus-within:border-[#2aaed3] focus-within:ring-[#2aaed3]/15'
    );

  return (
    <div className="w-full max-w-[430px]">
      <form
        className="nad-login-card rounded-[24px] border border-white/70 px-5 py-6 shadow-[0_28px_90px_-28px_rgba(4,12,34,0.65)] backdrop-blur-2xl sm:rounded-[28px] sm:px-9 sm:py-9"
        onSubmit={formik.handleSubmit}
        noValidate
      >
        <div className="mb-6 text-center sm:mb-7">
          <div className="mx-auto mb-2 flex h-[88px] w-[104px] items-center justify-center sm:mb-3 sm:h-[100px] sm:w-[118px]">
            <img
              src={toAbsoluteUrl('/media/logos/logo.png')}
              className="h-full w-full object-contain"
              alt="NAD"
            />
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-[#172550]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to continue.</p>
        </div>

        {formik.status && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            {formik.status}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-[#172550]">
              Email
            </label>
            <div className={fieldClass(Boolean(formik.touched.email && formik.errors.email))}>
              <Mail className="size-[18px] shrink-0 text-slate-400 transition-colors duration-150 group-focus-within:text-[#2aaed3]" aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                {...formik.getFieldProps('email')}
                className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                aria-invalid={Boolean(formik.touched.email && formik.errors.email)}
                aria-describedby="login-email-error"
              />
            </div>
            {formik.touched.email && formik.errors.email && (
              <p id="login-email-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
                {formik.errors.email}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="login-password" className="text-sm font-semibold text-[#172550]">
                Password
              </label>
              <Link
                to={resetPasswordPath}
                className="rounded text-xs font-semibold text-[#227f9e] outline-none transition-colors duration-150 hover:text-[#172550] focus-visible:ring-2 focus-visible:ring-[#2aaed3] focus-visible:ring-offset-2"
              >
                Forgot password?
              </Link>
            </div>
            <div className={fieldClass(Boolean(formik.touched.password && formik.errors.password))}>
              <LockKeyhole className="size-[18px] shrink-0 text-slate-400 transition-colors duration-150 group-focus-within:text-[#2aaed3]" aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                {...formik.getFieldProps('password')}
                className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                aria-invalid={Boolean(formik.touched.password && formik.errors.password)}
                aria-describedby="login-password-error"
              />
              <button
                type="button"
                onClick={togglePassword}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 outline-none transition-[background-color,color,transform] duration-150 hover:bg-slate-100 hover:text-[#172550] focus-visible:ring-2 focus-visible:ring-[#2aaed3] active:scale-[0.97]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
            {formik.touched.password && formik.errors.password && (
              <p id="login-password-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
                {formik.errors.password}
              </p>
            )}
          </div>
        </div>

        <label className="mt-5 flex w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            {...formik.getFieldProps('remember')}
            className="size-4 rounded border-slate-300 text-[#2aaed3] focus:ring-2 focus:ring-[#2aaed3]/30 focus:ring-offset-1"
          />
          <span>Remember me</span>
        </label>

        <button
          type="submit"
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172550] px-4 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(23,37,80,0.9)] outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#213363] hover:shadow-[0_15px_28px_-14px_rgba(23,37,80,0.95)] focus-visible:ring-4 focus-visible:ring-[#72d6ee]/45 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-65 disabled:shadow-none disabled:active:scale-100"
          disabled={loading || formik.isSubmitting}
        >
          {loading && <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />}
          <span>{loading ? 'Signing in…' : 'Sign in'}</span>
        </button>
      </form>
    </div>
  );
};

export { Login };

import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { KeenIcon } from '@/components';
import { useAuthContext } from '@/auth';
import { useLayout } from '@/providers';
import { toAbsoluteUrl } from '@/utils';

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Wrong email format')
    .min(3, 'Minimum 3 symbols')
    .max(50, 'Maximum 50 symbols')
    .required('Email is required'),
  password: Yup.string()
    .min(3, 'Minimum 3 symbols')
    .max(50, 'Maximum 50 symbols')
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
  const { login, auth } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [showPassword, setShowPassword] = useState(false);
  const { currentLayout } = useLayout();
  const rememberedEmail = useMemo(() => localStorage.getItem('email') || '', []);

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
          throw new Error('JWTProvider is required for this form.');
        }

        await login(values.email, values.password);

        if (values.remember) {
          localStorage.setItem('email', values.email);
        } else {
          localStorage.removeItem('email');
        }

        navigate(from, { replace: true });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'The login details are incorrect');
        setSubmitting(false);
      }
      setLoading(false);
    }
  });

  const togglePassword = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-full max-w-[460px]">
      <form
        className="space-y-6 rounded-[28px] border border-slate-200 bg-white px-7 py-8 shadow-[0_18px_50px_-25px_rgba(15,23,42,0.18)] md:px-10 md:py-10"
        onSubmit={formik.handleSubmit}
        noValidate
      >
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3">
            <img
              src={toAbsoluteUrl('/media/logo/logo.png')}
              className="h-8 w-auto"
              alt="NAD Requisition"
            />
            <span className="text-base font-semibold text-slate-500">Logo</span>
          </div>

          <div className="space-y-2">
            <h3 className="text-3xl font-semibold tracking-tight text-slate-900 leading-tight">
              Log in to Your Account
            </h3>
            <p className="text-sm text-slate-500">
              Welcome back! 
            </p>
          </div>

          {/* <div className="flex items-center justify-between text-sm text-slate-500">
            <span>New here?</span>
            <Link
              to={currentLayout?.name === 'auth-branded' ? '/auth/signup' : '/auth/classic/signup'}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Sign up
            </Link>
          </div> */}
        </div>

        {/* <div className="grid grid-cols-5 gap-2.5">
          <a href="#" className="flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50">
            N
          </a>
          <a href="#" className="flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:bg-blue-50">
            <img src={toAbsoluteUrl('/media/brand-logos/google.svg')} className="size-4" alt="Google" />
          </a>
          <a href="#" className="flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:bg-blue-50">
            <KeenIcon icon="facebook" className="text-slate-700" />
          </a>
          <a href="#" className="flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:bg-blue-50">
            <KeenIcon icon="apple" className="text-slate-700" />
          </a>
          <a href="#" className="flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:bg-blue-50">
            <KeenIcon icon="message-text" className="text-slate-700" />
          </a>
        </div>

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>Or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div> */}

        {formik.status && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {formik.status}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-900">Email</label>
          <label className="input rounded-xl border-slate-200 bg-white shadow-none">
            <input
              placeholder="Enter your email"
              autoComplete="off"
              {...formik.getFieldProps('email')}
              className={clsx('form-control bg-transparent', {
                'is-invalid': formik.touched.email && formik.errors.email
              })}
            />
          </label>
          {formik.touched.email && formik.errors.email && (
            <span role="alert" className="text-danger text-xs mt-1">
              {formik.errors.email}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1">
            <label className="text-sm font-medium text-slate-900">Password</label>
            <Link
              to={
                currentLayout?.name === 'auth-branded'
                  ? '/auth/reset-password'
                  : '/auth/classic/reset-password'
              }
              className="text-sm shrink-0 font-semibold text-blue-600 hover:text-blue-700"
            >
              Forgot password?
            </Link>
          </div>
          <label className="input rounded-xl border-slate-200 bg-white shadow-none">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="off"
              {...formik.getFieldProps('password')}
              className={clsx('form-control bg-transparent', {
                'is-invalid': formik.touched.password && formik.errors.password
              })}
            />
            <button className="btn btn-icon" onClick={togglePassword} type="button">
              <KeenIcon icon="eye" className={clsx('text-gray-500', { hidden: showPassword })} />
              <KeenIcon
                icon="eye-slash"
                className={clsx('text-gray-500', { hidden: !showPassword })}
              />
            </button>
          </label>
          {formik.touched.password && formik.errors.password && (
            <span role="alert" className="text-danger text-xs mt-1">
              {formik.errors.password}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="checkbox-group">
            <input
              className="checkbox checkbox-sm"
              type="checkbox"
              {...formik.getFieldProps('remember')}
            />
            <span className="checkbox-label text-slate-600">Remember me for 30 days</span>
          </label>
          <Link
            to={
              currentLayout?.name === 'auth-branded'
                ? '/auth/reset-password'
                : '/auth/classic/reset-password'
            }
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="btn btn-primary flex justify-center grow h-11 w-full rounded-xl text-sm font-semibold"
          disabled={loading || formik.isSubmitting}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-center text-xs text-slate-500 mt-1">
          Protected workspace access for authorized users.
        </p>
      </form>
    </div> 
    
  );
};

export { Login };

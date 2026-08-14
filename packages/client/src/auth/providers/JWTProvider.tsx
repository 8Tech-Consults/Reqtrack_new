/* eslint-disable no-unused-vars */
import axios, { AxiosResponse } from 'axios';
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useEffect,
  useState
} from 'react';

import * as authHelper from '../_helpers';
import { type AuthModel, type UserModel } from '@/auth';
import { MAIN_URL } from '@/config/urls';

const normalizeGraphqlUrl = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // Prevent accidental double slashes and double `/graphql`.
  const withoutTrailingSlashes = raw.replace(/\/+$/, '');
  return withoutTrailingSlashes.endsWith('/graphql')
    ? withoutTrailingSlashes
    : `${withoutTrailingSlashes}/graphql`;
};

// Prefer explicit env (if provided), otherwise fall back to the Apollo URL.
// This prevents `verify()` from calling the Vite dev server (`/graphql`) and
// immediately logging users out after a successful Apollo login.
const GRAPHQL_URL =
  normalizeGraphqlUrl(import.meta.env.VITE_APP_API_URL) ||
  normalizeGraphqlUrl(MAIN_URL) ||
  '/graphql';

type GraphQLErrorShape = { message?: string };
type GraphQLResponse<T> = { data?: T; errors?: GraphQLErrorShape[] };

const gql = async <TData, TVars extends Record<string, any> | undefined>(params: {
  operationName: string;
  query: string;
  variables?: TVars;
}): Promise<TData> => {
  const { data } = await axios.post<GraphQLResponse<TData>>(GRAPHQL_URL, {
    operationName: params.operationName,
    query: params.query,
    variables: params.variables
  });

  if (data?.errors?.length) {
    const message = data.errors[0]?.message || 'Request failed';
    throw new Error(message);
  }

  if (!data?.data) {
    throw new Error('Empty response');
  }

  return data.data;
};

interface AuthContextProps {
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  auth: AuthModel | undefined;
  saveAuth: (auth: AuthModel | undefined) => void;
  currentUser: UserModel | undefined;
  setCurrentUser: Dispatch<SetStateAction<UserModel | undefined>>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle?: () => Promise<void>;
  loginWithFacebook?: () => Promise<void>;
  loginWithGithub?: () => Promise<void>;
  register: (payload: {
    username: string;
    name: string;
    // company_initials: string;
    premises_location: string;
    phone_number: string;
    email: string;
    district: string;
    password: string;
  }) => Promise<void>;
  requestPasswordResetLink: (email: string) => Promise<void>;
  changePassword: (
    token: string,
    password: string,
    password_confirmation: string
  ) => Promise<void>;
  changeMyPassword: (
    password: string,
    password_confirmation: string
  ) => Promise<void>;
  getUser: () => Promise<AxiosResponse<UserModel | null>>;
  logout: () => void;
  verify: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | null>(null);

const AuthProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<AuthModel | undefined>(authHelper.getAuth());
  const [currentUser, setCurrentUser] = useState<UserModel | undefined>();

  const verify = async () => {
    if (auth) {
      try {
        const { data: user } = await getUser();
        setCurrentUser(user ?? undefined);
      } catch {
        saveAuth(undefined);
        setCurrentUser(undefined);
      }
    }
  };

  const saveAuth = (auth: AuthModel | undefined) => {
    setAuth(auth);
    if (auth) {
      authHelper.setAuth(auth);
    } else {
      authHelper.removeAuth();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const data = await gql<{ login: { token: string; user?: UserModel } }, any>({
        operationName: 'Login',
        query: `mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            token
            user {
              id
              username
              name
              email
              image
              must_change_password
              role_id
              role_name
            }
          }
        }`,
        variables: {
          email,
          password
        }
      });

      if (!data?.login?.token) {
        throw new Error(data?.login?.user ? 'Login failed. Please try again.' : 'Invalid email or password.');
      }

      const authPayload: AuthModel = {
        access_token: data.login.token,
        api_token: data.login.token
      };

      saveAuth(authPayload);

      // Prefer server-returned user; otherwise fetch via `me`
      if (data.login.user) {
        setCurrentUser(data.login.user);
      } else {
        const { data: user } = await getUser();
        setCurrentUser(user ?? undefined);
      }
    } catch (error) {
      saveAuth(undefined);
      throw error instanceof Error ? error : new Error('Invalid email or password.');
    }
  };

  const register = async (payload: {
    username: string;
    name: string;
    // company_initials: string;
    premises_location: string;
    phone_number: string;
    email: string;
    district: string;
    password: string;
  }) => {
    try {
      await gql<{ register: { success: boolean; message?: string; user?: UserModel } }, any>({
        operationName: 'Register',
        query: `mutation Register($payload: RegisterInput!) {
          register(payload: $payload) {
            success
            message
            user {
              id
              username
              name
              email
              image
              role_id
              role_name
            }
          }
        }`,
        variables: { payload }
      });

      // After successful registration, log in to get a token.
      await login(payload.username || payload.email, payload.password);
    } catch (error) {
      saveAuth(undefined);
      throw error instanceof Error ? error : new Error('Registration failed. Please try again.');
    }
  };

  const requestPasswordResetLink = async (email: string) => {
    await gql<{ requestPasswordResetLink: { success: boolean; message?: string } }, { email: string }>(
      {
        operationName: 'RequestPasswordResetLink',
        query: `mutation RequestPasswordResetLink($email: String!) {
          requestPasswordResetLink(email: $email) {
            success
            message
          }
        }`,
        variables: { email }
      }
    );
  };

  const changePassword = async (
    token: string,
    password: string,
    password_confirmation: string
  ) => {
    if (password !== password_confirmation) {
      throw new Error('Passwords do not match');
    }

    await gql<
      { resetPasswordWithToken: { success: boolean; message?: string } },
      { token: string; newPassword: string }
    >({
      operationName: 'ResetPasswordWithToken',
      query: `mutation ResetPasswordWithToken($token: String!, $newPassword: String!) {
        resetPasswordWithToken(token: $token, newPassword: $newPassword) {
          success
          message
        }
      }`,
      variables: {
        token,
        newPassword: password
      }
    });
  };

  const changeMyPassword = async (
    password: string,
    password_confirmation: string
  ) => {
    if (password !== password_confirmation) {
      throw new Error('Passwords do not match');
    }

    const data = await gql<
      { changeMyPassword: { token: string; user?: UserModel } },
      { newPassword: string }
    >({
      operationName: 'ChangeMyPassword',
      query: `mutation ChangeMyPassword($newPassword: String!) {
        changeMyPassword(newPassword: $newPassword) {
          token
          user {
            id
            username
            name
            email
            district
            image
            must_change_password
            role_id
            role_name
          }
        }
      }`,
      variables: {
        newPassword: password
      }
    });

    const authPayload: AuthModel = {
      access_token: data.changeMyPassword.token,
      api_token: data.changeMyPassword.token
    };

    saveAuth(authPayload);

    if (data.changeMyPassword.user) {
      setCurrentUser(data.changeMyPassword.user);
      return;
    }

    const { data: user } = await getUser();
    setCurrentUser(user ?? undefined);
  };

  const getUser = async () => {
    const data = await gql<{ me: UserModel | null }, undefined>({
      operationName: 'Me',
      query: `query Me {
        me {
          id
          username
          name
          email
          image
          role_id
          role_name
          district
          must_change_password
        }
      }`
    });

    return {
      data: data.me,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    } as AxiosResponse<UserModel | null>;
  };

  const logout = () => {
    saveAuth(undefined);
    setCurrentUser(undefined);

    if (typeof window !== 'undefined') {
      const loginPath = '/auth/login';
      if (window.location.pathname !== loginPath) {
        window.location.replace(loginPath);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        setLoading,
        auth,
        saveAuth,
        currentUser,
        setCurrentUser,
        login,
        register,
        requestPasswordResetLink,
        changePassword,
        changeMyPassword,
        getUser,
        logout,
        verify
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };

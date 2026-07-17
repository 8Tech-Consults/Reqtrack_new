import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
  ServerParseError
} from '@apollo/client/errors';

const GENERIC_ERROR =
  'Something went wrong. Please try again, or contact support if it continues.';
const NETWORK_ERROR = 'We couldn’t connect. Check your internet connection and try again.';
const TIMEOUT_ERROR = 'The request timed out. Please check your connection and try again.';
const LOGIN_ERROR = 'The phone/email or password is incorrect. Please check and try again.';

const normalize = (message: string) =>
  message
    .trim()
    .replace(/^Exception:\s*/i, '')
    .replace(/^GraphQLError:\s*/i, '')
    .replace(/^ApolloError:\s*/i, '')
    .replace(/^Login failed:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const looksLikeLoginFailure = (message: string) =>
  message.includes('invalid username or password') ||
  message.includes('invalid username') ||
  message.includes('invalid password') ||
  message.includes('wrong password') ||
  message.includes('incorrect password') ||
  message.includes('check your credentials');

const looksLikeNetworkFailure = (message: string) =>
  message.includes('failed to fetch') ||
  message.includes('network error') ||
  message.includes('networkerror') ||
  message.includes('load failed') ||
  message.includes('connection refused') ||
  message.includes('failed to connect') ||
  message.includes('xmlhttprequest error');

const looksLikeTimeout = (message: string) =>
  message.includes('timeout') || message.includes('timed out');

const looksLikeSessionFailure = (message: string) =>
  message.includes('jwt expired') ||
  message.includes('invalid token') ||
  message.includes('unauthorized') ||
  message.includes('please sign in');

const looksInternal = (message: string) =>
  message.includes('graphql request failed') ||
  message.includes('internal server error') ||
  message.includes('stack trace') ||
  message.includes('sql') ||
  message.includes('database') ||
  message.includes('errno') ||
  message.includes('exception:') ||
  message.includes('is not a function') ||
  message.includes('cannot read properties');

const rawErrorMessage = (error: unknown): string => {
  if (!error) return '';

  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.map((item) => item.message).filter(Boolean).join(', ');
  }

  if (CombinedProtocolErrors.is(error)) {
    return error.errors.map((item) => item.message).filter(Boolean).join(', ');
  }

  if (ServerError.is(error) || ServerParseError.is(error)) {
    return NETWORK_ERROR;
  }

  if (error instanceof Error) return error.message;

  if (typeof error === 'object') {
    const candidate = error as {
      message?: string;
      networkError?: { message?: string };
      graphQLErrors?: { message?: string }[];
      response?: { data?: { message?: string; errors?: Record<string, unknown> } };
    };

    const responseMessage = candidate.response?.data?.message;
    if (responseMessage) return responseMessage;

    const responseErrors = candidate.response?.data?.errors;
    if (responseErrors && typeof responseErrors === 'object') {
      const first = Object.values(responseErrors)[0];
      if (Array.isArray(first) && first[0]) return String(first[0]);
      if (first) return String(first);
    }

    if (candidate.graphQLErrors?.[0]?.message) return candidate.graphQLErrors[0].message;
    if (candidate.networkError?.message) return candidate.networkError.message;
    if (candidate.message) return candidate.message;
  }

  return String(error);
};

export const getUserFriendlyErrorMessage = (
  error: unknown,
  fallback = GENERIC_ERROR,
  options?: { context?: string }
) => {
  const normalized = normalize(rawErrorMessage(error));
  const fallbackText = normalize(fallback);
  const lower = normalized.toLowerCase();

  if (looksLikeLoginFailure(lower)) return LOGIN_ERROR;
  if (looksLikeNetworkFailure(lower)) return NETWORK_ERROR;
  if (looksLikeTimeout(lower)) return TIMEOUT_ERROR;
  if (looksLikeSessionFailure(lower)) return 'Your session has expired. Please sign in again.';
  if (!normalized || looksInternal(lower)) return fallbackText || GENERIC_ERROR;

  const context = options?.context?.trim();
  if (context && !normalized.toLowerCase().startsWith(context.toLowerCase())) {
    return `${context} ${normalized}`;
  }

  return normalized;
};

export const toFriendlyErrorMessage = (
  error: unknown,
  fallbackOrOptions?:
    | string
    | {
        fallback?: string;
        context?: string;
      },
  options?: { context?: string }
) => {
  if (typeof fallbackOrOptions === 'string') {
    return getUserFriendlyErrorMessage(error, fallbackOrOptions, options);
  }

  return getUserFriendlyErrorMessage(
    error,
    fallbackOrOptions?.fallback || GENERIC_ERROR,
    fallbackOrOptions?.context ? { context: fallbackOrOptions.context } : undefined
  );
};

export const errorCopy = {
  generic: GENERIC_ERROR,
  network: NETWORK_ERROR,
  timeout: TIMEOUT_ERROR,
  login: LOGIN_ERROR
};

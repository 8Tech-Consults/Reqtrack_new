declare module 'apollo-upload-client/UploadHttpLink.mjs' {
  import { ApolloLink } from '@apollo/client';

  export type UploadHttpLinkOptions = {
    uri?: string | ((operation: unknown) => string);
    fetch?: typeof globalThis.fetch;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
    includeExtensions?: boolean;
    useGETForQueries?: boolean;
    fetchOptions?: RequestInit;
  };

  export default class UploadHttpLink extends ApolloLink {
    constructor(options?: UploadHttpLinkOptions);
  }
}

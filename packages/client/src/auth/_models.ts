import { type TLanguageCode } from '@/i18n';

export interface AuthModel {
  access_token: string;
  refreshToken?: string;
  api_token: string;
}

export interface UserModel {
  id: number | string;
  username: string;
  name: string;
  email: string;
  district?: string | null;
  phone_number?: string | null;
  image?: string | null;
  role_id?: string | null;
  role_name?: string | null;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
  language?: TLanguageCode;
  auth?: AuthModel;
}

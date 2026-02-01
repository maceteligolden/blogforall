export interface SignupInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export interface ChangePasswordInput {
  old_password: string;
  new_password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    plan: string;
  };
  requiresSiteCreation?: boolean; // True if user needs to create a site (for first-time login after migration)
}

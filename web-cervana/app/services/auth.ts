import type { Tokens } from "~/interfaces/api";
import type { CheckResponse, LoginResponse, ProfileResponse, refreshTokenResponse, RegisterResponse } from "~/interfaces/auth";
import { request } from "~/lib/api";
import type { 
  LoginSchemaType, 
  RegisterSchemaType, 
  ResetPasswordSchemaType, 
  VerificationSchemaType 
} from "~/schemas";

export const authService = {
  async register(data: Omit<RegisterSchemaType, "agree">) {
    return request<RegisterResponse>("/auth/register", "POST", data);
  },

  async login(data: Omit<LoginSchemaType, 'rememberMe'>) {
    return request<LoginResponse>("/auth/login", "POST", data);
  },

  async logout() {
    return request<null>("/auth/logout", "DELETE");
  },

  async getCurrentUser() {
    return request<ProfileResponse>("/auth/profile", "GET");
  },

  async check(tokens?:Tokens) {
    return request<CheckResponse>('/auth/check', 'GET', undefined, {}, undefined, tokens);
  },

  async verifyOtp(data: VerificationSchemaType) {
    return request<CheckResponse>("/auth/verify-email", "POST", data);
  },

  async forgotPassword(email: string) {
    return request<null>("/auth/forgot-password?type=pw", "POST", { email });
  },

  async resetPassword(data:ResetPasswordSchemaType) {
    return request<null>(`/auth/reset-password`, "POST", { ...data });
  },

  async refreshToken(tokens?:Tokens) {
    return request<refreshTokenResponse>("/auth/refresh-token", "POST",null,{},true, tokens);
  },

  async resendOtp(email: string,  type:string) {
    return request<null>(`/auth/resend-token?type=${type}`, "POST", { email });
  }
};

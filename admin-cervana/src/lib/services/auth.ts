import type { CheckResponse, LoginResponse, ProfileResponse } from "$lib/types/auth.type";
import { request } from "$lib/utils/request";
import type { LoginSchemaType } from "../../features/auth/auth.schema";


export const authService = {
  async login(data: Omit<LoginSchemaType, "rememberMe">) {
    return request<LoginResponse>("/auth/login", "POST", data);
  },

  async logout() {
    return request<null>("/auth/logout", "DELETE");
  },

  async getCurrentUser() {
    return request<ProfileResponse>("/auth/profile", "GET");
  },

  async check(tokens?: { access_token?: string; refresh_token?: string }) {
    return request<CheckResponse>("/auth/check", "GET", undefined, {}, true, fetch, tokens);
  },

  async refreshToken(tokens?: { access_token?: string; refresh_token?: string }) {
    return request<{
      access_token:string,
      refresh_token:string
    }>("/auth/refresh-token", "POST", undefined, {}, true, fetch, tokens);
  },
};

import { defineStore } from "pinia";
import { getCookie, setCookie, deleteCookie } from "h3";
import type { H3Event } from "h3";

export const useAuth = defineStore("auth", {
  state: () => ({
    access_token: "",
    refresh_token: "",
  }),

  getters: {
    isAuthenticated: (state) => !!state.access_token,
  },

  actions: {
    setTokens(access: string, refresh: string, event?: H3Event) {
      this.access_token = access;
      this.refresh_token = refresh;

      if (process.server && event) {
        setCookie(event, "access_token", access, {
          httpOnly: true,
          path: "/",
        });

        setCookie(event, "refresh_token", refresh, {
          httpOnly: true,
          path: "/",
        });

        return;
      }

      if (process.client) {
        const accessCookie = useCookie("access_token");
        const refreshCookie = useCookie("refresh_token");

        accessCookie.value = access;
        refreshCookie.value = refresh;
      }
    },

    clearTokens(event?: H3Event) {
      this.access_token = "";
      this.refresh_token = "";

      if (process.server && event) {
        deleteCookie(event, "access_token");
        deleteCookie(event, "refresh_token");
        return;
      }

      if (process.client) {
        const accessCookie = useCookie("access_token");
        const refreshCookie = useCookie("refresh_token");

        accessCookie.value = null;
        refreshCookie.value = null;
      }
    },

    loadTokensFromCookie(event?: H3Event) {
      if (process.server && event) {
        this.access_token = getCookie(event, "access_token") || "";
        this.refresh_token = getCookie(event, "refresh_token") || "";
        return;
      }

      if (process.client) {
        const accessCookie = useCookie("access_token");
        const refreshCookie = useCookie("refresh_token");

        this.access_token = accessCookie.value || "";
        this.refresh_token = refreshCookie.value || "";
      }
    },
  },
});

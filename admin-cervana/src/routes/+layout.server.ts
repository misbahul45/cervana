import { authService } from "$lib/services/auth";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
  if (!locals.user) {
    const refresh_token = cookies.get("refresh_token");

    if (refresh_token) {
      try {
        const newTokens = await authService.refreshToken({ refresh_token });

        if (newTokens?.data?.access_token) {
          const access_token = newTokens.data.access_token;

          cookies.set("access_token", access_token, {
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 15 * 60,
          });

          cookies.set("refresh_token", refresh_token, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: true,
            maxAge: 30 * 24 * 60 * 60,
          });

          const res = await authService.check({
            access_token,
            refresh_token,
          });

          locals.user = res.data?.user ?? null;
        }
      } catch (err) {
        console.error("Failed to refresh token:", err);
      }
    }
  }

  return {
    user: locals.user,
    pathName: url.pathname,
  };
};

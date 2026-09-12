import { validateForm } from "$lib/utils/validations/validateForm";
import { withTryCatch } from "$lib/utils/validations/tryHandler";
import type { Actions } from "@sveltejs/kit";
import { LoginSchema } from "../../../features/auth/auth.schema";
import { authService } from "$lib/services/auth";

export const actions = {
  login: async ({ request, cookies }) =>
    withTryCatch(async () => {
      const formData = await request.formData();
      const email = formData.get("email");
      const password = formData.get("password");

      const data = { email, password };

      const { data: parsed } = await validateForm(LoginSchema, data);
      const res = await authService.login(parsed);

      if (res?.success && res.data) {
        const { access_token, refresh_token } = res.data;

        cookies.set("access_token", access_token, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          maxAge:  1 * 24 * 60 * 60,
        });

        cookies.set("refresh_token", refresh_token, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          maxAge: 30 * 24 * 60 * 60,
        });
      }
      return res;
    }),
} satisfies Actions;

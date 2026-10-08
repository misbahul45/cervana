import type { CheckResponse, User } from "~/interfaces/auth";
import { authService } from "~/services/auth";

const SESSION_COOKIE = /(?:^|;\s*)(?:access_token|refresh_token)=/;

export default defineNuxtPlugin(async () => {
  const user = useState<User | null>("user", () => null);
  const cookie = useRequestHeaders(["cookie"]).cookie ?? "";
  if (!SESSION_COOKIE.test(cookie)) return;

  const res = await authService.check();
  user.value = res.success && res.data?.authenticated ? (res.data as CheckResponse).user : null;
});

import { useAuth } from "~/stores/auth";

export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuth();
  const event = nuxtApp.ssrContext?.event;
  auth.loadTokensFromCookie(event);
});

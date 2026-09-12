import { request } from "$lib/utils/request";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, locals }) => {
  const access_token = cookies.get("access_token");
  const refresh_token = cookies.get("refresh_token");
  const user = locals.user;

  const tokens = {
    access_token,
    refresh_token
  };

  const query = new URLSearchParams({
    createdBy: user?.id ?? "",
    page: "1",
    limit: "10"
  }).toString();

  const res = await request<{
  }>(
    `/curriculum/topics?${query}`,
    "GET",
    undefined,
    {},
    true,
    fetch,
    tokens
  );

  const { data }=res

  return {
    ...data
  }
};

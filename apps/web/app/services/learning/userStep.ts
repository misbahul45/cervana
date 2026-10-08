import type { Query, Tokens } from "~/interfaces/api"
import type { UserStepDetailResponse, UserStepListResponse } from "~/interfaces/learning/userSteps"
import { apiUrl, request, toQueryString } from "~/lib/api"

export const userStepService = {
  async complete(id:string, token?:Tokens){
    const url=`/learning/user-steps/complete/${id}`
    return request<UserStepListResponse>(
      url,
      "POST",
      undefined,
      {},
      true,
      token
    )
  },
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/user-steps?${queryString}`
      : "/learning/user-steps"

    return request<UserStepListResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/user-steps/${id}?${queryString}`
      : `/learning/user-steps/${id}`

    return request<UserStepDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },
  listenUserStepsSse() {
    return new EventSource(apiUrl("/user-steps-sse"), {
      withCredentials: true
    })
  },
}

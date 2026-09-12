import type { Query, Tokens } from "~/interfaces/api"
import type {
  LessonProgress,
  LessonProgressDetailResponse,
  LessonProgressListResponse
} from "~/interfaces/learning/lessonProgress"
import { request, toQueryString } from "~/lib/api"

export const lessonProgressService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/lesson-progresses?${queryString}`
      : "/learning/lesson-progresses"

    return request<LessonProgressListResponse<IncludeRelations>>(
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
      ? `/learning/lesson-progresses/${id}?${queryString}`
      : `/learning/lesson-progresses/${id}`

    return request<LessonProgressDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async create(data:{
    userId:string;
    lessonId:string;
  }, tokens?: Tokens) {
    return request<LessonProgressDetailResponse>(
      `/learning/lesson-progresses`,
      "POST",
      data,
      { "Content-Type": "application/json" },
      true,
      tokens
    )
  },

  async update(id: string, data: Partial<LessonProgress>, tokens?: Tokens) {
    return request<LessonProgressDetailResponse>(
      `/learning/lesson-progresses/${id}`,
      "PATCH",
      data,
      { "Content-Type": "application/json" },
      true,
      tokens
    )
  }
}

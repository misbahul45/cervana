import type { Query, Tokens } from "~/interfaces/api"
import type { 
  BaseLesson, 
  LessonDetailResponse, 
  LessonsListResponse, 
  PrevLessonResponse, 
  NextLessonResponse 
} from "~/interfaces/curriculum/lessons"
import { request, toQueryString } from "~/lib/api"

export const lessonsService = {
  async findAll<IncludeRelations extends boolean = false>(q: Query = {}, tokens?: Tokens) {
    const queryString = toQueryString(q)
    const url = queryString ? `/curriculum/lessons?${queryString}` : "/curriculum/lessons"
    return request<LessonsListResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },

  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/curriculum/lessons/${id}?${queryString}` : `/curriculum/lessons/${id}`
    return request<LessonDetailResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },

  async findPrev<IncludeRelations extends boolean = false>(
    id: string,
    tokens?: Tokens
  ) {
    const url = `/curriculum/lessons/${id}/prev`
    return request<PrevLessonResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },

  async findNext<IncludeRelations extends boolean = false>(
    id: string,
    tokens?: Tokens
  ) {
    const url = `/curriculum/lessons/${id}/next`
    return request<NextLessonResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },

}

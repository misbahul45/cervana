import type { Query, Tokens } from "~/interfaces/api"
import type { CategoriesListResponse, CategoryDetailResponse } from "~/interfaces/categories"
import { request, toQueryString } from "~/lib/api"


export const categoriesService = {
  async findAll<IncludeTopics extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/categories?${queryString}` : "/categories"
    return request<CategoriesListResponse<IncludeTopics>>(url, "GET", undefined, {}, true, tokens)
  },

  async findOne<IncludeTopics extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/categories/${id}?${queryString}` : `/categories/${id}`
    return request<CategoryDetailResponse<IncludeTopics>>(url, "GET", undefined, {}, true, tokens)
  },
}

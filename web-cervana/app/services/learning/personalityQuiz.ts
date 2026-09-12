import type { Query, Tokens } from "~/interfaces/api"
import type {
  PersonalityQuizListResponse,
  PersonalityQuizDetailResponse,
  UpdatePersonalityQuizDto,
  PersonalityQuizUserAttemptItem
} from "~/interfaces/learning/personalityQuiz"
import { request, toQueryString } from "~/lib/api"
import { useRuntimeConfig } from "#imports"

export const personalityQuizService = {
  async findAll(q: Query = {}, tokens?: Tokens) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/personality-quizzes?${queryString}`
      : `/learning/personality-quizzes`
    return request<PersonalityQuizListResponse>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async findOne(id: string, q: Query = {}, tokens?: Tokens) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/personality-quizzes/${id}?${queryString}`
      : `/learning/personality-quizzes/${id}`
    return request<PersonalityQuizDetailResponse>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async update(id: string, body: UpdatePersonalityQuizDto, tokens?: Tokens) {
    return request(
      `/learning/personality-quizzes/${id}`,
      "PATCH",
      body,
      {},
      true,
      tokens
    )
  },

  async generateStream(
    payload: {
      lessonId: string
      topicId: string
      learningStyleId: string
      userId: string
    },
    tokens?: Tokens
  ) {
    const config = useRuntimeConfig()
    const AI_URL = config.public.AI_URL

    const qs = new URLSearchParams({
      lessonId: payload.lessonId,
      topicId: payload.topicId,
      learningStyleId: payload.learningStyleId,
      userId: payload.userId,
      token: tokens?.access_token ?? ""
    })

    return new EventSource(
      `${AI_URL}/users-steps/generate-question?${qs.toString()}`,
      { withCredentials: true }
    )
  },

  listenPersonalityQuizSse(tokens?: Tokens) {
    const config = useRuntimeConfig()
    const API_URL = config.public.API_URL
    return new EventSource(`${API_URL}/personality-quiz-sse`, {
      withCredentials: true
    })
  },
  submitQuiz(quizId:string, q:Query, body:PersonalityQuizUserAttemptItem[]){
    const queryString = toQueryString(q) 
    const url=`/learning/personality-quizzes/submit/${quizId}?${queryString}`
      return request(
        url,
        "PATCH",
        body,
        {},
        true,
      )
  }
}

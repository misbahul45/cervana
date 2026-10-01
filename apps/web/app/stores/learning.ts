// ~/stores/learning.ts
export const useLearning = defineStore('learning', {
   persist: true,
  state: () => ({
    topicId: '' as string,
    subTopicId: '' as string,
    lessonId: '' as string,
    stepId: '' as string,
    userStepId:'' as string,
    learningStyleId: '' as string
  }),
  actions: {
    setTopic(id: string) {
      this.topicId = id
    },
    setSubTopic(id: string) {
      this.subTopicId = id
    },
    setLesson(id: string) {
      this.lessonId = id
    },
    setStep(id: string) {
      this.stepId = id
    },
    setUserStep(id: string) {
      this.userStepId = id
    },  
    setLearningStyle(id: string) {
      this.learningStyleId = id
    },

    resetPartial() {
      this.subTopicId = ''
      this.lessonId = ''
      this.stepId = ''
    },
    resetAll() {
      this.topicId = ''
      this.subTopicId = ''
      this.lessonId = ''
      this.stepId = ''
      this.learningStyleId = ''
    }
  }
})

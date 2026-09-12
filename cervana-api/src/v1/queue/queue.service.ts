import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue("knowledge") private readonly knowledgeQueue: Queue,
    @InjectQueue("content") private readonly contentQueue: Queue,
    @InjectQueue('user-steps') private readonly userStepsQueue:Queue
  ) {}

  async addKnowledgeJob(data: { resourceId: string; token: string }) {
    await this.knowledgeQueue.add("embed", data, { removeOnComplete: true });
  }

  async addContentEmbeddingJob(data: {
    contentId: string;
    chatId: string;
    textContent: string;
  }) {
    await this.contentQueue.add("embed", data, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 }, 
    });
  }

  async addUserStepsJob(data:{
    userId: string
    token: string
    topicId: string
    lessonId: string
    learningStyleId: string
    quizId:string
  }){
    await this.userStepsQueue.add("generate-user-steps", data, {
      removeOnComplete:true,     
    })
  }
}

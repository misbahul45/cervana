import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { JobsOptions, Queue } from "bullmq";
import {
  ContentEmbeddingJob,
  ContentEmbeddingJobSchema,
  KnowledgeJob,
  KnowledgeJobSchema,
  UserStepsJob,
  UserStepsJobSchema,
} from "./queue-payloads";

export const FAILED_JOB_RETENTION = { age: 7 * 24 * 60 * 60, count: 500 };

export const JOB_OPTIONS: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: FAILED_JOB_RETENTION,
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
};

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue("knowledge") private readonly knowledgeQueue: Queue,
    @InjectQueue("content") private readonly contentQueue: Queue,
    @InjectQueue('user-steps') private readonly userStepsQueue:Queue
  ) {}

  async addKnowledgeJob(data: KnowledgeJob) {
    await this.knowledgeQueue.add("embed", KnowledgeJobSchema.parse(data), JOB_OPTIONS);
  }

  async addContentEmbeddingJob(data: ContentEmbeddingJob) {
    await this.contentQueue.add("embed", ContentEmbeddingJobSchema.parse(data), JOB_OPTIONS);
  }

  async addUserStepsJob(data: UserStepsJob) {
    await this.userStepsQueue.add("generate-user-steps", UserStepsJobSchema.parse(data), JOB_OPTIONS);
  }
}

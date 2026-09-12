import type { SubTopic } from "./subTopic.type";
import type { Step } from "./step.type";
import type { Resource } from "./resource.type";

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  sortOrder: number;
  subTopicId: string;
  subTopic?: SubTopic;
  steps?: Step[];
  resources?: Resource[];
  createdAt: Date;
  updatedAt: Date;
}

import type { User } from "./auth.type";

export enum ChatRole {
  SYSTEM = "SYSTEM",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  ASSISTANT = "ASSISTANT"
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  sender?: User;
  role: ChatRole;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chat {
  id: string;
  title?: string;
  topicId?: string;
  participants: string[]; 
  messages?: ChatMessage[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

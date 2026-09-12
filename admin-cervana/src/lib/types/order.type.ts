export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface Order {
  id: string;
  userId: string;
  topicId: string;
  amount: number;
  status: OrderStatus;
}

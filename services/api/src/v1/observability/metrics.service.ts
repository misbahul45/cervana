import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface ToolInvocationMetric {
  toolName: string;
  userId: string;
  outcome: 'success' | 'failure';
  latencyMs: number;
}

export interface AgentMetric {
  agent: string;
  outcome: 'success' | 'failure' | 'budget_exceeded';
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

@Injectable()
export class MetricsService {
  readonly registry: Registry;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestTotal: Counter<string>;
  private readonly agentInvocationTotal: Counter<string>;
  private readonly agentInvocationDuration: Histogram<string>;
  private readonly agentBudgetRemaining: Gauge<string>;
  private readonly toolInvocationTotal: Counter<string>;
  private readonly toolInvocationDuration: Histogram<string>;
  private readonly aiCreditBalance: Gauge<string>;
  private readonly learnerMasteryDistribution: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    this.httpRequestDuration = new Histogram({
      name: 'reducera_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });
    this.httpRequestTotal = new Counter({
      name: 'reducera_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.agentInvocationTotal = new Counter({
      name: 'reducera_agent_invocations_total',
      help: 'Total agent invocations',
      labelNames: ['agent', 'outcome'],
      registers: [this.registry],
    });
    this.agentInvocationDuration = new Histogram({
      name: 'reducera_agent_invocation_duration_seconds',
      help: 'Agent invocation duration in seconds',
      labelNames: ['agent', 'outcome'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });
    this.agentBudgetRemaining = new Gauge({
      name: 'reducera_agent_budget_remaining',
      help: 'Remaining agent budget for the current request (tokens or seconds)',
      labelNames: ['agent', 'budget_type'],
      registers: [this.registry],
    });

    this.toolInvocationTotal = new Counter({
      name: 'reducera_tool_invocations_total',
      help: 'Total tool invocations',
      labelNames: ['tool', 'outcome'],
      registers: [this.registry],
    });
    this.toolInvocationDuration = new Histogram({
      name: 'reducera_tool_invocation_duration_seconds',
      help: 'Tool invocation duration in seconds',
      labelNames: ['tool', 'outcome'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.aiCreditBalance = new Gauge({
      name: 'reducera_ai_credit_balance',
      help: 'AI credit balance per user',
      labelNames: ['user_id'],
      registers: [this.registry],
    });

    this.learnerMasteryDistribution = new Gauge({
      name: 'reducera_learner_mastery',
      help: 'Learner mastery gauge by topic',
      labelNames: ['user_id', 'topic_id'],
      registers: [this.registry],
    });
  }

  recordHttp(method: string, route: string, status: number, durationSeconds: number) {
    this.httpRequestDuration.labels(method, route, String(status)).observe(durationSeconds);
    this.httpRequestTotal.labels(method, route, String(status)).inc();
  }

  recordAgent(metric: AgentMetric) {
    const labels = { agent: metric.agent, outcome: metric.outcome };
    this.agentInvocationTotal.labels(labels).inc();
    this.agentInvocationDuration.labels(labels).observe(metric.latencyMs / 1000);
  }

  recordTool(metric: ToolInvocationMetric) {
    this.toolInvocationTotal.labels(metric.toolName, metric.outcome).inc();
    this.toolInvocationDuration.labels(metric.toolName, metric.outcome).observe(metric.latencyMs / 1000);
  }

  setAiCreditBalance(userId: string, balance: number) {
    this.aiCreditBalance.labels(userId).set(balance);
  }

  setMastery(userId: string, topicId: string, score: number) {
    this.learnerMasteryDistribution.labels(userId, topicId).set(score);
  }

  async snapshot() {
    return this.registry.metrics();
  }
}

import { MetricsService } from '../metrics.service';

describe('MetricsService', () => {
  describe('AC-171: dashboards for AI failures, latency, cost', () => {
    it('records HTTP requests with method + route + status + duration', async () => {
      const svc = new MetricsService();
      svc.recordHttp('POST', '/v1/tutor/message', 200, 0.123);
      svc.recordHttp('POST', '/v1/tutor/message', 200, 0.456);
      svc.recordHttp('POST', '/v1/tutor/message', 500, 1.234);
      const out = await svc.snapshot();
      expect(out).toMatch(/reducera_http_requests_total/);
      expect(out).toMatch(/reducera_http_request_duration_seconds/);
    });

    it('records agent invocations with outcome labels', async () => {
      const svc = new MetricsService();
      svc.recordAgent({ agent: 'tutor', outcome: 'success', latencyMs: 350 });
      svc.recordAgent({ agent: 'tutor', outcome: 'failure', latencyMs: 1200 });
      const out = await svc.snapshot();
      expect(out).toMatch(/reducera_agent_invocations_total/);
      expect(out).toContain('outcome="success"');
      expect(out).toContain('outcome="failure"');
    });

    it('records tool invocations with outcome', async () => {
      const svc = new MetricsService();
      svc.recordTool({ toolName: 'retrieveKnowledge', userId: 'u1', outcome: 'success', latencyMs: 80 });
      svc.recordTool({ toolName: 'retrieveKnowledge', userId: 'u1', outcome: 'failure', latencyMs: 4500 });
      const out = await svc.snapshot();
      expect(out).toMatch(/reducera_tool_invocations_total/);
    });

    it('tracks AI credit balance per user', async () => {
      const svc = new MetricsService();
      svc.setAiCreditBalance('u-1', 250);
      svc.setAiCreditBalance('u-2', 0);
      const out = await svc.snapshot();
      expect(out).toContain('reducera_ai_credit_balance{user_id="u-1"} 250');
      expect(out).toContain('reducera_ai_credit_balance{user_id="u-2"} 0');
    });

    it('tracks mastery gauge per user + topic', async () => {
      const svc = new MetricsService();
      svc.setMastery('u-1', 't-1', 0.7);
      const out = await svc.snapshot();
      expect(out).toContain('reducera_learner_mastery');
    });
  });

  describe('AC-196: dashboards for learner failure', () => {
    it('exposes metrics in Prometheus text format', async () => {
      const svc = new MetricsService();
      svc.recordAgent({ agent: 'tutor', outcome: 'success', latencyMs: 200 });
      const out = await svc.snapshot();
      expect(typeof out).toBe('string');
      expect((out as string).split('\n').length).toBeGreaterThan(1);
    });
  });
});

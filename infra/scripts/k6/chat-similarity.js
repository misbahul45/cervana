import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '2m',
  thresholds: {
    'http_req_duration{name:list_endpoint}': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:80';
const TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const res = http.get(`${BASE}/api/v1/categories`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    tags: { name: 'list_endpoint' },
  });
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'duration < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(0.05);
}
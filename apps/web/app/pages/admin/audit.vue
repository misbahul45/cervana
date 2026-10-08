<script setup lang="ts">
definePageMeta({
  title: 'Audit — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});
</script>

<template>
  <main id="main" aria-labelledby="audit-h">
    <header>
      <h1 id="audit-h">Audit</h1>
      <p>Catatan perubahan state otoritatif. Read-only untuk pengguna biasa.</p>
    </header>

    <section class="rc-admin-audit__filters">
      <label>Actor
        <input type="search" placeholder="actor id" />
      </label>
      <label>Action
        <select>
          <option value="">semua</option>
          <option value="approve">approve</option>
          <option value="reject">reject</option>
          <option value="publish">publish</option>
          <option value="mint">mint</option>
        </select>
      </label>
      <label>Date
        <input type="date" />
      </label>
    </section>

    <table class="rc-admin-audit__table" aria-label="Audit log">
      <thead>
        <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Result</th><th>Trace</th></tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in [
          { ts: '2026-10-05T10:01:12Z', actor: 'admin-1', action: 'approve', result: 'success', trace: 'req-1' },
          { ts: '2026-10-05T11:32:00Z', actor: 'admin-1', action: 'reject', result: 'success', trace: 'req-2' },
          { ts: '2026-10-05T13:45:21Z', actor: 'admin-2', action: 'publish', result: 'success', trace: 'req-3' },
        ]" :key="i">
          <td>{{ row.ts }}</td>
          <td>{{ row.actor }}</td>
          <td>{{ row.action }}</td>
          <td>{{ row.result }}</td>
          <td><code>{{ row.trace }}</code></td>
        </tr>
      </tbody>
    </table>

    <p>Audit records are historical data. Modifikasi hanya melalui admin dengan capability menulis.</p>
  </main>
</template>

<style scoped>
.rc-admin-audit__filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
.rc-admin-audit__filters label {
  display: flex;
  flex-direction: column;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-admin-audit__table {
  width: 100%;
  border-collapse: collapse;
}
.rc-admin-audit__table th,
.rc-admin-audit__table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  text-align: left;
  font-size: 0.875rem;
}
</style>
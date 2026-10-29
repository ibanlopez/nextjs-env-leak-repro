import { ClientEnvDisplay } from '@/components/client-env-display';

export default function Page() {
  return (
    <main>
      <h1>Server-only env var leak repro</h1>
      <ClientEnvDisplay />
    </main>
  );
}

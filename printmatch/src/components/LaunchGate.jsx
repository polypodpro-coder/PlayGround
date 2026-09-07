export default function LaunchGate() {
  return (
    <main className="app-shell bg-navy text-white px-6 py-12">
      <p className="text-sm font-semibold text-accent">Poly Pod Pro</p>
      <h1 className="mt-4 text-3xl font-bold">Local makers. Custom parts.</h1>
      <p className="mt-4 text-white/80">A marketplace connecting buyers with independent US print farms.</p>
      <section className="mt-8 rounded-2xl bg-white/10 p-5" aria-labelledby="launch-status">
        <h2 id="launch-status" className="text-lg font-semibold">Preparing for launch</h2>
        <p className="mt-3 text-sm text-white/80">
          Registration, uploads, and payments are not open yet. We are preparing
          seller onboarding and reviewing the ordering experience before accepting customers.
        </p>
      </section>
    </main>
  );
}

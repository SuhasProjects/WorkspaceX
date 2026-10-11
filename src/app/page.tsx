export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-foreground/60">WORKSPACEZERO</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Small software. Shared workspace.</h1>
      <p className="max-w-xl text-lg leading-8 text-foreground/70">
        Create and share custom mini-apps with your team. The shared application
        foundation is ready; workspace access and the builder are coming next.
      </p>
      <a className="w-fit rounded-lg border border-foreground/20 px-5 py-3 font-medium hover:bg-foreground/5" href="/api/health">
        Check application health
      </a>
    </main>
  );
}
interface PlaceholderPageProps {
  title: string;
  /** Sub-task that will replace this placeholder. */
  plannedIn: number;
}

export default function PlaceholderPage({ title, plannedIn }: PlaceholderPageProps) {
  return (
    <section className="flex flex-col gap-2 py-8">
      <h1 className="font-serif text-3xl text-accent-400">{title}</h1>
      <p className="text-parchment-400">This page is coming soon (sub-task {plannedIn}).</p>
    </section>
  );
}

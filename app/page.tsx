import { Trainer } from "@/components/trainer";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">FR → EN</h1>
      </header>
      <Trainer />
    </main>
  );
}

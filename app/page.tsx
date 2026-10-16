import { Progress } from "@/components/progress";
import { Settings } from "@/components/settings";
import { SidePanel } from "@/components/side-panel";
import { Trainer } from "@/components/trainer";

// One page: the settings on the left, the exercise in the middle and the
// progress on the right. On a phone, the exercise comes first.
export default function Home() {
  const side =
    "flex flex-col gap-6 lg:sticky lg:top-12 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto";
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 content-start items-start gap-8 px-4 py-12 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-8 lg:order-2">
        <Trainer />
      </div>
      <aside className={`lg:order-1 ${side}`}>
        <SidePanel title="Settings">
          <Settings />
        </SidePanel>
      </aside>
      <aside className={`lg:order-3 ${side}`}>
        <SidePanel title="My progress">
          <Progress />
        </SidePanel>
      </aside>
    </main>
  );
}

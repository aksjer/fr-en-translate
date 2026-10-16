import { Panel } from "@/components/panel";
import { Progress } from "@/components/progress";
import { Settings } from "@/components/settings";
import { Trainer } from "@/components/trainer";

// One page: the settings on the left, the exercise in the middle and the
// progress on the right. On a wide screen the page fits the window and each
// column scrolls on its own; on a phone, the exercise comes first.
export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-8 px-4 py-12 lg:h-dvh lg:flex-none lg:grid-cols-[18rem_minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] lg:py-8">
      <div className="flex flex-col lg:order-2 lg:min-h-0">
        <Panel title="Exercise">
          <Trainer />
        </Panel>
      </div>
      <div className="flex flex-col lg:order-1 lg:min-h-0">
        <Panel title="Settings" collapsible>
          <Settings />
        </Panel>
      </div>
      <div className="flex flex-col lg:order-3 lg:min-h-0">
        <Panel title="My progress" collapsible>
          <Progress />
        </Panel>
      </div>
    </main>
  );
}

import { Panel } from "@/components/panel";
import { Progress } from "@/components/progress";
import { Settings } from "@/components/settings";
import { Trainer } from "@/components/trainer";

// One page: the settings on the left, the exercise in the middle and the
// progress on the right. On a wide screen the page fits the window and each
// column scrolls on its own, and the side columns can fold into thin strips;
// on a phone, the exercise comes first.
export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-8 px-4 py-12 lg:h-dvh lg:flex-none lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-rows-[minmax(0,1fr)] lg:py-8">
      <div className="flex flex-col lg:order-2 lg:min-h-0">
        <Panel title="Exercise">
          <Trainer />
        </Panel>
      </div>
      <div className="flex flex-col lg:order-1 lg:min-h-0">
        <Panel title="Settings" collapsible side="left" width="lg:w-72">
          <Settings />
        </Panel>
      </div>
      <div className="flex flex-col lg:order-3 lg:min-h-0">
        <Panel title="My progress" collapsible side="right" width="lg:w-80">
          <Progress />
        </Panel>
      </div>
    </main>
  );
}

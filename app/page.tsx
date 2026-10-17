import { Panel } from "@/components/panel";
import { Progress } from "@/components/progress";
import { Settings } from "@/components/settings";
import { SideColumn, SideColumnToggle } from "@/components/side-column";
import { Trainer } from "@/components/trainer";

// One page: the settings and the progress on the left, the exercise on the
// right. On a wide screen the page fits the window, each column scrolls on its
// own, the side panels fold up to their titles and the whole left column can
// be hidden; on a phone, the exercise comes first, in a frame.
export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-8 px-4 py-12 lg:h-dvh lg:flex-none lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:py-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 lg:order-2 lg:min-h-0 lg:overflow-y-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 dark:border-zinc-800 dark:bg-zinc-950 lg:dark:bg-transparent">
        <Trainer />
      </div>
      <SideColumn>
        <Panel title="Settings" action={<SideColumnToggle />}>
          <Settings />
        </Panel>
        <Panel title="My progress" stack={1}>
          <Progress />
        </Panel>
      </SideColumn>
    </main>
  );
}

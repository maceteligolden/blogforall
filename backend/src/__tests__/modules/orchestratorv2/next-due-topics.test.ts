import { compareNextDueTopics, type NextDueTopic } from "../../../modules/orchestratorv2/orchestrator.next-due";

function topic(partial: Partial<NextDueTopic> & Pick<NextDueTopic, "title" | "sequence_index">): NextDueTopic {
  return {
    campaign_id: "camp-1",
    campaign_name: "Evergreen",
    objective: "",
    strategic_intent: "",
    overdue: false,
    ...partial,
  };
}

describe("compareNextDueTopics", () => {
  it("ranks overdue first, then soonest scheduled, then sequence", () => {
    const overdueLater = topic({
      title: "Overdue later",
      sequence_index: 2,
      overdue: true,
      scheduled_at: "2026-01-20T00:00:00.000Z",
    });
    const overdueSooner = topic({
      title: "Overdue sooner",
      sequence_index: 5,
      overdue: true,
      scheduled_at: "2026-01-10T00:00:00.000Z",
    });
    const upcoming = topic({
      title: "Upcoming",
      sequence_index: 0,
      scheduled_at: "2026-09-01T00:00:00.000Z",
    });
    const unscheduledA = topic({ title: "Unscheduled A", sequence_index: 1 });
    const unscheduledB = topic({ title: "Unscheduled B", sequence_index: 3 });

    const ranked = [unscheduledB, upcoming, overdueLater, unscheduledA, overdueSooner].sort(compareNextDueTopics);
    expect(ranked.map((item) => item.title)).toEqual([
      "Overdue sooner",
      "Overdue later",
      "Upcoming",
      "Unscheduled A",
      "Unscheduled B",
    ]);
  });
});

import { useEffect, useState } from "react";
import { MockExamService, type MockFull } from "@/services/cloud/MockExamService";
import { computeCandidateResult } from "@/mock/mockEngine";
import type { MockSnapshot } from "@/mock/mockAnalysis";

export function toSnapshot(full: MockFull): MockSnapshot {
  const { mock, subjects, candidates, marks } = full;
  return {
    mockId: mock.id,
    mockName: mock.name,
    date: mock.startDate ?? mock.createdAt ?? "",
    status: mock.status,
    grading: mock.grading,
    subjects,
    candidates: candidates.map((c) => ({ id: c.id, studentId: c.studentId, status: c.status, fullName: c.fullName })),
    marks,
    results: candidates.map((c) => computeCandidateResult(c, subjects, marks, mock.grading)),
    targetAggregate: mock.targetAggregate,
  };
}

/** Loads this school's other (non-draft) mocks so they can be compared with the one on screen. */
export function useMockSnapshots(current: MockFull) {
  const [others, setOthers] = useState<MockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await MockExamService.list();
        const mine = list.filter((m) => m.schoolId === current.mock.schoolId && m.id !== current.mock.id && m.status !== "draft");
        const fulls = await Promise.all(mine.map((m) => MockExamService.getFull(m.id)));
        if (!cancelled) setOthers(fulls.map(toSnapshot));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the other mocks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current.mock.id, current.mock.schoolId]);

  const currentSnap = toSnapshot(current);
  const all = [...others, currentSnap].sort((a, b) => a.date.localeCompare(b.date));
  return { others, all, currentSnap, loading, error };
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@database/db";
import type { Enrollment } from "@models/Enrollment";
import { getFullName, type Student } from "@models/Student";
import type { ProficiencyRating } from "@models/AssessmentRecord";
import { SkillRecordService } from "@services/SkillRecordService";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";

interface Props {
  classId: number;
  termId: number;
  levelId: number;
  sessionId: number;
  roster: Enrollment[];
  readOnly: boolean;
  performedBy: string;
  onSaved: () => void;
}

interface CellValue {
  recordId?: number;
  rating: ProficiencyRating | null;
}

const RATING_META: Record<ProficiencyRating, { label: string; short: string; badge: string }> = {
  G: { label: "Gold", short: "G", badge: "btn-outline-warning" },
  S: { label: "Silver", short: "S", badge: "btn-outline-secondary" },
  B: { label: "Bronze", short: "B", badge: "btn-outline-danger" },
  X: { label: "Not assessed", short: "X", badge: "btn-outline-dark" },
  O: { label: "Absent", short: "O", badge: "btn-outline-dark" },
};
const RATING_ORDER: ProficiencyRating[] = ["G", "S", "B", "X", "O"];

const COMMENT_DEBOUNCE_MS = 700;

/**
 * Module 8 - KG skill-assessment interface (KG1/KG2). Per the NaCCA
 * Kindergarten Assessment Tool this is strictly Gold/Silver/Bronze/X/O
 * ratings with an optional note per skill - NO scores, totals, averages
 * or rankings anywhere in this component (Module 9's validation and the
 * "Critical Instruction" both forbid it for KG).
 *
 * Learning areas are tabs; each tab's table has one column per skill in
 * that area (from the Skill config table, never hard-coded) and one row
 * per enrolled student.
 */
export function KGSkillGrid({ classId, termId, levelId, sessionId, roster, readOnly, performedBy, onSaved }: Props) {
  void classId;

  const studentIds = useMemo(() => roster.map((e) => e.studentId).sort((a, b) => a - b), [roster]);
  const studentIdsKey = studentIds.join(",");

  const students = useLiveQuery(async () => {
    const list = await db.students.bulkGet(studentIds);
    return list
      .filter((s): s is Student => !!s)
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentIdsKey]);

  const learningAreas = useLiveQuery(
    async () => {
      const list = await db.learningAreas.filter((a) => a.isActive && a.levelIds.includes(levelId)).toArray();
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [levelId],
  );

  const skills = useLiveQuery(
    async () => {
      const list = await db.skills.where("levelId").equals(levelId).filter((s) => s.isActive).toArray();
      return list.sort((a, b) => a.sortOrder - b.sortOrder || a.serialNumber - b.serialNumber);
    },
    [levelId],
  );

  const [activeAreaId, setActiveAreaId] = useState<number | null>(null);
  useEffect(() => {
    if (learningAreas && learningAreas.length > 0 && activeAreaId === null) {
      setActiveAreaId(learningAreas[0].id!);
    }
  }, [learningAreas, activeAreaId]);

  const ratingsRef = useRef<Map<string, CellValue>>(new Map());
  const [ratingsVersion, setRatingsVersion] = useState(0);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingArgs = useRef<Map<string, { studentId: number; skillId: number; rating: ProficiencyRating | null; comment: string | undefined }>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!students || !skills || students.length === 0 || skills.length === 0) return;
      const relevantSkillIds = new Set(skills.map((sk) => sk.id!));
      const relevantStudentIds = new Set(students.map((s) => s.id!));
      const all = await SkillRecordService.getForTerm(termId);
      const map = new Map<string, CellValue>();
      const comments: Record<string, string> = {};
      for (const rec of all) {
        if (!relevantStudentIds.has(rec.studentId) || !relevantSkillIds.has(rec.skillId)) continue;
        const key = `${rec.studentId}:${rec.skillId}`;
        map.set(key, { recordId: rec.id, rating: rec.rating });
        comments[key] = rec.comment ?? "";
      }
      if (!cancelled) {
        ratingsRef.current = map;
        setCommentText(comments);
        setRatingsVersion((v) => v + 1);
        setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [students, skills, termId]);

  async function flushOne(key: string) {
    const args = pendingArgs.current.get(key);
    if (!args) return;
    timers.current.delete(key);
    pendingArgs.current.delete(key);
    try {
      await SkillRecordService.upsertRating(args.studentId, termId, args.skillId, args.rating, args.comment, sessionId, performedBy);
      onSaved();
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
    }
  }

  useEffect(() => {
    return () => {
      for (const [key, timer] of timers.current) {
        clearTimeout(timer);
        void flushOne(key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistNow(studentId: number, skillId: number, rating: ProficiencyRating | null, comment: string | undefined) {
    const key = `${studentId}:${skillId}`;
    const existingTimer = timers.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timers.current.delete(key);
    } else {
      setPendingCount((c) => c + 1);
    }
    pendingArgs.current.set(key, { studentId, skillId, rating, comment });
    void flushOne(key);
  }

  function schedulePersistComment(studentId: number, skillId: number, comment: string) {
    const key = `${studentId}:${skillId}`;
    const cell = ratingsRef.current.get(key);
    pendingArgs.current.set(key, { studentId, skillId, rating: cell?.rating ?? null, comment });
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    else setPendingCount((c) => c + 1);
    const timer = setTimeout(() => void flushOne(key), COMMENT_DEBOUNCE_MS);
    timers.current.set(key, timer);
  }

  function setRating(studentId: number, skillId: number, rating: ProficiencyRating) {
    const key = `${studentId}:${skillId}`;
    const prev = ratingsRef.current.get(key) ?? { rating: null };
    const nextRating = prev.rating === rating ? null : rating; // click again to clear
    ratingsRef.current.set(key, { ...prev, rating: nextRating });
    setRatingsVersion((v) => v + 1);
    persistNow(studentId, skillId, nextRating, commentText[key]);
  }

  function setComment(studentId: number, skillId: number, value: string) {
    const key = `${studentId}:${skillId}`;
    setCommentText((prev) => ({ ...prev, [key]: value }));
    schedulePersistComment(studentId, skillId, value);
  }

  const loading = !students || !learningAreas || !skills || !ready;
  if (loading) return <LoadingSpinner label="Loading KG skill checklist…" />;

  if (learningAreas!.length === 0) {
    return (
      <EmptyState
        icon="bi-journal-x"
        title="No learning areas configured for this level"
        message="Add learning areas and skills for this KG level under Settings before rating students."
      />
    );
  }

  const areaSkills = skills!.filter((sk) => sk.learningAreaId === activeAreaId);

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-2 small">
        <div className="text-muted">
          Rate each skill Gold / Silver / Bronze, or mark Not assessed / Absent. Click a selected rating again to
          clear it. Per the NaCCA Kindergarten Assessment Tool, there are no scores, totals or class rankings here.
        </div>
        {!readOnly ? (
          <div className={pendingCount > 0 ? "text-warning" : "text-success"}>
            <i className={`bi ${pendingCount > 0 ? "bi-cloud-arrow-up" : "bi-cloud-check"} me-1`} />
            {pendingCount > 0 ? "Saving…" : "All changes saved"}
          </div>
        ) : (
          <div className="text-muted">
            <i className="bi bi-lock-fill me-1" />
            Read-only - this assessment is finalized.
          </div>
        )}
      </div>

      <ul className="nav nav-tabs mb-3">
        {learningAreas!.map((area) => (
          <li className="nav-item" key={area.id}>
            <button
              type="button"
              className={`nav-link ${activeAreaId === area.id ? "active" : ""}`}
              onClick={() => setActiveAreaId(area.id!)}
            >
              {area.name}
            </button>
          </li>
        ))}
      </ul>

      {areaSkills.length === 0 ? (
        <EmptyState
          icon="bi-journal-x"
          title="No skills in this learning area"
          message="Add skills for this learning area and level under Settings - KG Skills."
        />
      ) : (
        <div className="actrs-grid-scroll">
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th className="actrs-grid-frozen-col">Student</th>
                {areaSkills.map((skill) => (
                  <th key={skill.id} style={{ minWidth: 220 }}>
                    {skill.serialNumber}. {skill.description}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students!.map((student) => (
                <tr key={student.id}>
                  <td className="actrs-grid-frozen-col fw-semibold" style={{ minWidth: 160 }}>
                    {getFullName(student)}
                  </td>
                  {areaSkills.map((skill) => {
                    const key = `${student.id}:${skill.id}`;
                    void ratingsVersion;
                    const cell = ratingsRef.current.get(key);
                    return (
                      <td key={skill.id} className="p-2">
                        <div className="btn-group btn-group-sm mb-1" role="group" aria-label={`Rating for ${skill.description}`}>
                          {RATING_ORDER.map((r) => (
                            <button
                              key={r}
                              type="button"
                              disabled={readOnly}
                              className={`btn ${RATING_META[r].badge} ${cell?.rating === r ? "active" : ""}`}
                              title={RATING_META[r].label}
                              onClick={() => setRating(student.id!, skill.id!, r)}
                            >
                              {RATING_META[r].short}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Note (optional)"
                          disabled={readOnly}
                          value={commentText[key] ?? ""}
                          onChange={(e) => setComment(student.id!, skill.id!, e.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

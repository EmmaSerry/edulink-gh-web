import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MutableRefObject } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@database/db";
import type { Enrollment } from "@models/Enrollment";
import { getFullName, type Student } from "@models/Student";
import type { Subject } from "@models/Subject";
import {
  computeSubjectTotal,
  findGradeBand,
  resolveGradeBandsForLevel,
  computeCompetitionRanking,
  computeOverallForStudent,
  isValidComponentScore,
  MIN_COMPONENT_SCORE,
  MAX_COMPONENT_SCORE,
  type RankedItem,
} from "@services/AssessmentCalculationEngine";
import { ScoreRecordService } from "@services/ScoreRecordService";
import { GradeBandService } from "@services/GradeBandService";
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

type Field = "sbaScore" | "examScore";

interface CellValue {
  recordId?: number;
  sbaScore: number | null;
  examScore: number | null;
}

interface HistoryEntry {
  studentId: number;
  subjectId: number;
  field: Field;
  prev: number | null;
  next: number | null;
}

const DEBOUNCE_MS = 600;

/**
 * Module 2 - Primary/JHS score entry grid, plus Modules 4-7 (automatic
 * calculations, grade bands, subject & overall ranking) rendered live as
 * the teacher types.
 *
 * Design notes:
 *  - The grid is seeded ONCE from Dexie (see the load effect below) and
 *    from then on treats its own in-memory state as the source of truth,
 *    writing THROUGH to Dexie on a short debounce per cell. It does not
 *    re-subscribe to a live query on scoreRecords while mounted - doing
 *    so would fight with in-progress typing every time this component's
 *    own writes land. This is the same "local optimistic state, debounced
 *    write-through" pattern any spreadsheet-like UI needs.
 *  - Totals/grade-bands/rankings are NEVER stored - they are recomputed
 *    from the raw SBA/Exam numbers on every change (see
 *    AssessmentCalculationEngine), so they can never drift out of sync.
 *  - `recordsVersion` is a plain counter used to force a re-render after
 *    a mutation to the `recordsRef` map, avoiding an expensive React
 *    state copy of the whole grid on every keystroke.
 */
export function ScoreEntryGrid({ classId, termId, levelId, sessionId, roster, readOnly, performedBy, onSaved }: Props) {
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

  const subjects = useLiveQuery(
    async () => {
      const list = await db.subjects.filter((s) => s.isActive && s.levelIds.includes(levelId)).toArray();
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [levelId],
  );

  const gradeBandsRaw = useLiveQuery(() => GradeBandService.getAll(), []);
  const gradeBands = useMemo(
    () => (gradeBandsRaw ? resolveGradeBandsForLevel(gradeBandsRaw, levelId) : []),
    [gradeBandsRaw, levelId],
  );

  const columns = useMemo(
    () => (subjects ?? []).flatMap((s) => [
      { subjectId: s.id!, field: "sbaScore" as Field },
      { subjectId: s.id!, field: "examScore" as Field },
    ]),
    [subjects],
  );

  const recordsRef = useRef<Map<string, CellValue>>(new Map());
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [cellText, setCellText] = useState<Record<string, string>>({});
  const [invalidCells, setInvalidCells] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingArgs = useRef<Map<string, { studentId: number; subjectId: number; field: Field; value: number | null }>>(
    new Map(),
  );
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(0);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  // One-time seed from Dexie once the roster's students & this level's
  // subjects are known. Intentionally NOT re-run on every scoreRecords
  // write (see design note above).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!students || !subjects || students.length === 0 || subjects.length === 0) return;
      const relevantSubjectIds = new Set(subjects.map((s) => s.id!));
      const relevantStudentIds = new Set(students.map((s) => s.id!));
      const all = await ScoreRecordService.getForTerm(termId);
      const map = new Map<string, CellValue>();
      const text: Record<string, string> = {};
      for (const rec of all) {
        if (!relevantStudentIds.has(rec.studentId) || !relevantSubjectIds.has(rec.subjectId)) continue;
        const key = `${rec.studentId}:${rec.subjectId}`;
        map.set(key, { recordId: rec.id, sbaScore: rec.sbaScore, examScore: rec.examScore });
        text[`${key}:sbaScore`] = rec.sbaScore === null ? "" : String(rec.sbaScore);
        text[`${key}:examScore`] = rec.examScore === null ? "" : String(rec.examScore);
      }
      if (!cancelled) {
        recordsRef.current = map;
        historyRef.current = [];
        historyIndexRef.current = 0;
        setCellText(text);
        setRecordsVersion((v) => v + 1);
        setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [students, subjects, termId]);

  async function flushOne(key: string) {
    const args = pendingArgs.current.get(key);
    if (!args) return;
    timers.current.delete(key);
    pendingArgs.current.delete(key);
    try {
      await ScoreRecordService.upsertField(args.studentId, termId, args.subjectId, args.field, args.value, sessionId, performedBy);
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

  function schedulePersist(studentId: number, subjectId: number, field: Field, value: number | null) {
    const key = `${studentId}:${subjectId}:${field}`;
    pendingArgs.current.set(key, { studentId, subjectId, field, value });
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    else setPendingCount((c) => c + 1);
    const timer = setTimeout(() => void flushOne(key), DEBOUNCE_MS);
    timers.current.set(key, timer);
  }

  function pushHistory(entry: HistoryEntry) {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current);
    historyRef.current.push(entry);
    historyIndexRef.current = historyRef.current.length;
  }

  function applyValidValue(studentId: number, subjectId: number, field: Field, value: number | null, opts?: { skipHistory?: boolean }) {
    const key = `${studentId}:${subjectId}`;
    const textKey = `${key}:${field}`;
    const prevCell = recordsRef.current.get(key) ?? { sbaScore: null, examScore: null };
    const prevValue = prevCell[field];

    recordsRef.current.set(key, { ...prevCell, [field]: value });
    setCellText((prev) => ({ ...prev, [textKey]: value === null ? "" : String(value) }));
    setInvalidCells((prev) => {
      if (!prev.has(textKey)) return prev;
      const next = new Set(prev);
      next.delete(textKey);
      return next;
    });
    setRecordsVersion((v) => v + 1);

    if (prevValue === value) return;
    if (!opts?.skipHistory) pushHistory({ studentId, subjectId, field, prev: prevValue, next: value });
    schedulePersist(studentId, subjectId, field, value);
  }

  function commitCell(studentId: number, subjectId: number, field: Field, rawText: string) {
    const textKey = `${studentId}:${subjectId}:${field}`;
    setCellText((prev) => ({ ...prev, [textKey]: rawText }));

    const trimmed = rawText.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const valid = parsed === null || (Number.isFinite(parsed) && isValidComponentScore(parsed));

    setInvalidCells((prev) => {
      const next = new Set(prev);
      if (valid) next.delete(textKey);
      else next.add(textKey);
      return next;
    });

    if (!valid) return;
    applyValidValue(studentId, subjectId, field, parsed);
  }

  function undo() {
    const idx = historyIndexRef.current;
    if (idx === 0) return;
    const entry = historyRef.current[idx - 1];
    historyIndexRef.current = idx - 1;
    applyValidValue(entry.studentId, entry.subjectId, entry.field, entry.prev, { skipHistory: true });
  }

  function redo() {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length) return;
    const entry = historyRef.current[idx];
    historyIndexRef.current = idx + 1;
    applyValidValue(entry.studentId, entry.subjectId, entry.field, entry.next, { skipHistory: true });
  }

  function focusCell(row: number, col: number) {
    const el = inputRefs.current[row]?.[col];
    if (el) {
      el.focus();
      el.select();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (isMod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
    const input = e.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusCell(row + 1, col);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusCell(row - 1, col);
        break;
      case "ArrowLeft":
        if (atStart) {
          e.preventDefault();
          focusCell(row, col - 1);
        }
        break;
      case "ArrowRight":
        if (atEnd) {
          e.preventDefault();
          focusCell(row, col + 1);
        }
        break;
      case "Enter":
        e.preventDefault();
        focusCell(row + 1, col);
        break;
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    if (!students) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const rows = text.replace(/\r/g, "").split("\n");
    while (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();

    rows.forEach((rowText, rOffset) => {
      const cells = rowText.split("\t");
      cells.forEach((cellValue, cOffset) => {
        const targetRow = row + rOffset;
        const targetCol = col + cOffset;
        if (targetRow >= students.length || targetCol >= columns.length) return;
        const student = students[targetRow];
        const column = columns[targetCol];
        commitCell(student.id!, column.subjectId, column.field, cellValue.trim());
      });
    });
  }

  // ---- Live calculations (Modules 4-7) --------------------------------
  const calc = useMemo(() => {
    if (!students || !subjects) return null;
    void recordsVersion; // recompute whenever the underlying cell map changes

    const perSubjectRanking = new Map<number, Map<number, RankedItem<{ studentId: number; total: number | null }>>>();
    for (const subject of subjects) {
      const items = students.map((st) => {
        const cell = recordsRef.current.get(`${st.id}:${subject.id}`);
        const total = cell ? computeSubjectTotal(cell.sbaScore, cell.examScore) : null;
        return { studentId: st.id!, total };
      });
      const ranked = computeCompetitionRanking(items, (x) => x.total);
      perSubjectRanking.set(subject.id!, new Map(ranked.map((r) => [r.item.studentId, r])));
    }

    const overallByStudent = new Map<number, { total: number; average: number; grade: string | undefined; scoredCount: number }>();
    const overallRankItems = students.map((st) => {
      const totals: number[] = [];
      for (const subject of subjects) {
        const cell = recordsRef.current.get(`${st.id}:${subject.id}`);
        const total = cell ? computeSubjectTotal(cell.sbaScore, cell.examScore) : null;
        if (total !== null) totals.push(total);
      }
      const overall = computeOverallForStudent(totals, gradeBands);
      overallByStudent.set(st.id!, {
        total: overall.total,
        average: overall.average,
        grade: overall.grade?.code,
        scoredCount: totals.length,
      });
      return { studentId: st.id!, average: totals.length > 0 ? overall.average : null };
    });
    const overallRanked = computeCompetitionRanking(overallRankItems, (x) => x.average);
    const overallRankByStudent = new Map(overallRanked.map((r) => [r.item.studentId, r]));

    return { perSubjectRanking, overallByStudent, overallRankByStudent };
  }, [recordsVersion, students, subjects, gradeBands]);

  const loading = !students || !subjects || !gradeBandsRaw || !ready || !calc;

  if (loading) return <LoadingSpinner label="Loading score sheet…" />;

  if (subjects!.length === 0) {
    return (
      <EmptyState
        icon="bi-journal-x"
        title="No subjects configured for this level"
        message="Add subjects for this level under Settings - Subjects before entering scores."
      />
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-2 small">
        <div className="text-muted">
          Scores are entered on a 0-{MAX_COMPONENT_SCORE} scale for both SBA and Exam ({MIN_COMPONENT_SCORE}-{MAX_COMPONENT_SCORE}).
          Total, grade band and position are calculated automatically. Paste a block copied from Excel starting at any
          cell; Ctrl+Z / Ctrl+Y undo and redo.
        </div>
        {!readOnly && (
          <div className={pendingCount > 0 ? "text-warning" : "text-success"}>
            <i className={`bi ${pendingCount > 0 ? "bi-cloud-arrow-up" : "bi-cloud-check"} me-1`} />
            {pendingCount > 0 ? "Saving…" : "All changes saved"}
          </div>
        )}
        {readOnly && (
          <div className="text-muted">
            <i className="bi bi-lock-fill me-1" />
            Read-only - this assessment is finalized.
          </div>
        )}
      </div>

      <div className="actrs-grid-scroll">
        <table className="table table-bordered mb-0">
          <thead>
            <tr>
              <th rowSpan={2} className="actrs-grid-frozen-col align-middle">
                Student
              </th>
              {subjects!.map((subject) => (
                <th key={subject.id} colSpan={5} className="text-center">
                  {subject.shortName || subject.name}
                </th>
              ))}
              <th colSpan={4} className="text-center">
                Overall
              </th>
            </tr>
            <tr>
              {subjects!.map((subject) => (
                <SubjectSubHeader key={subject.id} />
              ))}
              <th className="text-center">Total</th>
              <th className="text-center">Avg</th>
              <th className="text-center">Grade</th>
              <th className="text-center">Pos</th>
            </tr>
          </thead>
          <tbody>
            {students!.map((student, rowIndex) => {
              const overall = calc.overallByStudent.get(student.id!);
              const overallRank = calc.overallRankByStudent.get(student.id!);
              return (
                <tr key={student.id}>
                  <td className="actrs-grid-frozen-col fw-semibold" style={{ minWidth: 160 }}>
                    {getFullName(student)}
                  </td>
                  {subjects!.map((subject) => {
                    const cell = recordsRef.current.get(`${student.id}:${subject.id}`);
                    const total = cell ? computeSubjectTotal(cell.sbaScore, cell.examScore) : null;
                    const band = findGradeBand(total, gradeBands);
                    const rank = calc.perSubjectRanking.get(subject.id!)?.get(student.id!);
                    const sbaColIndex = columns.findIndex((c) => c.subjectId === subject.id && c.field === "sbaScore");
                    const examColIndex = columns.findIndex((c) => c.subjectId === subject.id && c.field === "examScore");

                    return (
                      <SubjectCells
                        key={subject.id}
                        student={student}
                        subject={subject}
                        rowIndex={rowIndex}
                        sbaColIndex={sbaColIndex}
                        examColIndex={examColIndex}
                        cellText={cellText}
                        invalidCells={invalidCells}
                        readOnly={readOnly}
                        total={total}
                        bandCode={band?.code}
                        positionText={rank?.positionText}
                        inputRefs={inputRefs}
                        onCommit={commitCell}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                      />
                    );
                  })}
                  <td className="text-center">{overall && overall.scoredCount > 0 ? overall.total : "—"}</td>
                  <td className="text-center">
                    {overall && overall.scoredCount > 0 ? overall.average.toFixed(1) : "—"}
                  </td>
                  <td className="text-center">{overall && overall.scoredCount > 0 ? overall.grade ?? "—" : "—"}</td>
                  <td className="text-center">{overallRank ? overallRank.positionText : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubjectSubHeader() {
  return (
    <>
      <th className="text-center small">SBA</th>
      <th className="text-center small">Exam</th>
      <th className="text-center small">Total</th>
      <th className="text-center small">Grade</th>
      <th className="text-center small">Pos</th>
    </>
  );
}

function SubjectCells({
  student,
  subject,
  rowIndex,
  sbaColIndex,
  examColIndex,
  cellText,
  invalidCells,
  readOnly,
  total,
  bandCode,
  positionText,
  inputRefs,
  onCommit,
  onKeyDown,
  onPaste,
}: {
  student: Student;
  subject: Subject;
  rowIndex: number;
  sbaColIndex: number;
  examColIndex: number;
  cellText: Record<string, string>;
  invalidCells: Set<string>;
  readOnly: boolean;
  total: number | null;
  bandCode: string | undefined;
  positionText: string | undefined;
  inputRefs: MutableRefObject<(HTMLInputElement | null)[][]>;
  onCommit: (studentId: number, subjectId: number, field: Field, rawText: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>, row: number, col: number) => void;
}) {
  const sbaKey = `${student.id}:${subject.id}:sbaScore`;
  const examKey = `${student.id}:${subject.id}:examScore`;

  function setRef(col: number, el: HTMLInputElement | null) {
    if (!inputRefs.current[rowIndex]) inputRefs.current[rowIndex] = [];
    inputRefs.current[rowIndex][col] = el;
  }

  return (
    <>
      <td className="p-1">
        <input
          ref={(el) => setRef(sbaColIndex, el)}
          className={`actrs-grid-cell-input ${invalidCells.has(sbaKey) ? "is-invalid" : ""}`}
          value={cellText[sbaKey] ?? ""}
          disabled={readOnly}
          inputMode="decimal"
          aria-label={`SBA score for ${getFullName(student)}, ${subject.name}`}
          onChange={(e) => onCommit(student.id!, subject.id!, "sbaScore", e.target.value)}
          onKeyDown={(e) => onKeyDown(e, rowIndex, sbaColIndex)}
          onPaste={(e) => onPaste(e, rowIndex, sbaColIndex)}
        />
      </td>
      <td className="p-1">
        <input
          ref={(el) => setRef(examColIndex, el)}
          className={`actrs-grid-cell-input ${invalidCells.has(examKey) ? "is-invalid" : ""}`}
          value={cellText[examKey] ?? ""}
          disabled={readOnly}
          inputMode="decimal"
          aria-label={`Exam score for ${getFullName(student)}, ${subject.name}`}
          onChange={(e) => onCommit(student.id!, subject.id!, "examScore", e.target.value)}
          onKeyDown={(e) => onKeyDown(e, rowIndex, examColIndex)}
          onPaste={(e) => onPaste(e, rowIndex, examColIndex)}
        />
      </td>
      <td className="text-center">{total ?? "—"}</td>
      <td className="text-center">{bandCode ?? "—"}</td>
      <td className="text-center">{positionText ?? "—"}</td>
    </>
  );
}

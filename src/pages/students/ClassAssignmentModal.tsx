import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { useToast } from "@contexts/ToastContext";
import { TermService } from "@services/TermService";
import { LevelService } from "@services/LevelService";
import { ClassService } from "@services/ClassService";
import { EnrollmentService } from "@services/EnrollmentService";
import { classAssignmentSchema, type ClassAssignmentFormValues } from "@validation/enrollmentSchema";
import { LEVEL_CATEGORIES, categorizeLevelCode, type LevelCategoryKey } from "@config/appConfig";
import type { SchoolClass } from "@models/SchoolClass";
import type { Level } from "@models/Level";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** One or more student ids being assigned in this action. */
  studentIds: number[];
  onDone?: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Module 3 - Class Enrollment. Used both for a single student (from the
 *  Student Profile "Enrollment" tab) and for bulk assignment (from the
 *  Students list bulk-action bar) - the underlying call is the same
 *  EnrollmentService.bulkAssignClass either way. */
export function ClassAssignmentModal({ isOpen, onClose, studentIds, onDone }: Props) {
  const { showToast } = useToast();
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClassAssignmentFormValues>({
    resolver: zodResolver(classAssignmentSchema),
    defaultValues: { termId: 0, levelId: 0, classId: 0, enrollmentDate: todayIso(), remarks: "" },
  });

  const [levelCategory, setLevelCategory] = useState<LevelCategoryKey | "">("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const active = terms?.find((t) => t.isActive);
      reset({ termId: active?.id ?? 0, levelId: 0, classId: 0, enrollmentDate: todayIso(), remarks: "" });
      setLevelCategory("");
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const classesWithLevel = useMemo(() => {
    const levelById = new Map((levels ?? []).map((l) => [l.id, l]));
    const rows: Array<{ cls: SchoolClass; level: Level }> = [];
    for (const c of classes ?? []) {
      if (!c.isActive) continue;
      const level = c.levelId ? levelById.get(c.levelId) : undefined;
      if (level) rows.push({ cls: c, level });
    }
    return rows;
  }, [classes, levels]);

  const availableCategories = useMemo(
    () => LEVEL_CATEGORIES.filter((cat) => classesWithLevel.some((x) => categorizeLevelCode(x.level.code) === cat.key)),
    [classesWithLevel],
  );

  const classOptionsForCategory = useMemo(
    () =>
      classesWithLevel
        .filter((x) => categorizeLevelCode(x.level.code) === levelCategory)
        .sort((a, b) => a.level.sortOrder - b.level.sortOrder),
    [classesWithLevel, levelCategory],
  );

  const selectedClassId = watch("classId");

  const onSubmit = async (values: ClassAssignmentFormValues) => {
    setSubmitError(null);
    try {
      const { succeeded, failed } = await EnrollmentService.bulkAssignClass(studentIds, values);
      if (failed.length === 0) {
        showToast(
          studentIds.length === 1
            ? "Student assigned to class."
            : `${studentIds.length} students assigned to class.`,
          "success",
        );
        onDone?.();
        onClose();
      } else if (succeeded.length === 0) {
        // Every row failed for the same reason in practice (a shared
        // term/level/class choice), so showing the first real message
        // is more useful here than a generic "please try again" that
        // hides what actually went wrong.
        setSubmitError(failed[0].message);
      } else {
        showToast(
          `${succeeded.length} of ${studentIds.length} assigned. ${failed.length} failed: ${failed[0].message}`,
          "error",
        );
        onDone?.();
        onClose();
      }
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error ? err.message : "Could not assign the class. Please try again.");
    }
  };

  return (
    <Modal
      title={studentIds.length === 1 ? "Assign class" : `Assign class to ${studentIds.length} students`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {submitError && (
          <div className="alert alert-danger py-2 small" role="alert">
            {submitError}
          </div>
        )}
        <FormField label="Term" required error={errors.termId?.message}>
          <select className="form-select" {...register("termId", { valueAsNumber: true })}>
            <option value={0}>Select…</option>
            {terms?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.termName} {t.isActive ? "(active)" : ""}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Level" required hint="KG, Primary or JHS - narrows the Class list below.">
          <select
            className="form-select"
            value={levelCategory}
            onChange={(e) => {
              const next = e.target.value as LevelCategoryKey | "";
              setLevelCategory(next);
              setValue("classId", 0, { shouldValidate: true });
              setValue("levelId", 0, { shouldValidate: true });
            }}
          >
            <option value="">Select…</option>
            {availableCategories.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Class" required error={errors.classId?.message || errors.levelId?.message}>
          <input type="hidden" {...register("levelId", { valueAsNumber: true })} />
          <select
            className="form-select"
            disabled={!levelCategory}
            value={selectedClassId || 0}
            {...register("classId", {
              valueAsNumber: true,
              onChange: (e) => {
                const classId = Number(e.target.value);
                const match = classOptionsForCategory.find((x) => x.cls.id === classId);
                setValue("levelId", match ? (match.level.id as number) : 0, { shouldValidate: true });
              },
            })}
          >
            <option value={0}>{levelCategory ? "Select…" : "Select a level first"}</option>
            {classOptionsForCategory.map(({ cls }) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Enrollment date" required error={errors.enrollmentDate?.message}>
          <input type="date" className="form-control" {...register("enrollmentDate")} />
        </FormField>
        <FormField label="Remarks (optional)" error={errors.remarks?.message}>
          <textarea className="form-control" rows={2} {...register("remarks")} />
        </FormField>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Assign</button>
        </div>
      </form>
    </Modal>
  );
}

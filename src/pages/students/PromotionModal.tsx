import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { useToast } from "@contexts/ToastContext";
import { AcademicYearService } from "@services/AcademicYearService";
import { TermService } from "@services/TermService";
import { LevelService } from "@services/LevelService";
import { ClassService } from "@services/ClassService";
import { PromotionService } from "@services/PromotionService";
import { promotionSchema, type PromotionFormValues } from "@validation/promotionSchema";

const todayIso = () => new Date().toISOString().slice(0, 10);

interface Props {
  studentId: number | null;
  onClose: () => void;
  onDone?: () => void;
}

/** Module 4 - Promotion History. Always appends a new Enrollment +
 *  PromotionHistoryEntry; never edits an existing record. */
export function PromotionModal({ studentId, onClose, onDone }: Props) {
  const { showToast } = useToast();
  const years = useLiveQuery(() => AcademicYearService.getAll(), []);
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      academicYearId: 0,
      toLevelId: 0,
      toClassId: 0,
      termId: 0,
      status: "PROMOTED",
      promotionDate: todayIso(),
      remarks: "",
    },
  });

  useEffect(() => {
    if (studentId) {
      const current = years?.find((y) => y.isCurrent);
      reset({
        academicYearId: current?.id ?? 0,
        toLevelId: 0,
        toClassId: 0,
        termId: 0,
        status: "PROMOTED",
        promotionDate: todayIso(),
        remarks: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const toLevelId = watch("toLevelId");
  const academicYearId = watch("academicYearId");
  const classesForLevel = classes?.filter((c) => Number(toLevelId) === c.levelId);
  // Phase 6 business-logic review (Module 3): the term dropdown must be
  // scoped to the selected academic year - otherwise a user could pick a
  // year and a term that belong to two different years, leaving
  // PromotionHistoryEntry.academicYearId and the resulting Enrollment's
  // own academicYearId (derived from the chosen term) silently
  // inconsistent with each other.
  const termsForYear = terms?.filter((t) => Number(academicYearId) === t.academicYearId);

  // Reset a previously-selected term if it no longer belongs to the
  // now-selected academic year (see the filtering comment above).
  useEffect(() => {
    const stillValid = termsForYear?.some((t) => t.id === watch("termId"));
    if (!stillValid) reset((prev) => ({ ...prev, termId: 0 }), { keepErrors: false, keepDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId]);

  if (!studentId) return null;

  const onSubmit = async (values: PromotionFormValues) => {
    try {
      await PromotionService.promote(studentId, values);
      showToast("Promotion recorded.", "success");
      onDone?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("Could not record the promotion.", "error");
    }
  };

  return (
    <Modal title="Record promotion / transfer" isOpen={!!studentId} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Academic year" required error={errors.academicYearId?.message}>
          <select className="form-select" {...register("academicYearId", { valueAsNumber: true })}>
            <option value={0}>Select…</option>
            {years?.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </FormField>
        <FormField
          label="Starting term"
          required
          error={errors.termId?.message}
          hint={!academicYearId ? "Select an academic year first" : undefined}
        >
          <select className="form-select" {...register("termId", { valueAsNumber: true })} disabled={!academicYearId}>
            <option value={0}>Select…</option>
            {termsForYear?.map((t) => <option key={t.id} value={t.id}>{t.termName}</option>)}
          </select>
        </FormField>
        <div className="row">
          <div className="col-md-6">
            <FormField label="New level" required error={errors.toLevelId?.message}>
              <select className="form-select" {...register("toLevelId", { valueAsNumber: true })}>
                <option value={0}>Select…</option>
                {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="col-md-6">
            <FormField label="New class" required error={errors.toClassId?.message}>
              <select className="form-select" {...register("toClassId", { valueAsNumber: true })}>
                <option value={0}>Select…</option>
                {classesForLevel?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
        </div>
        <FormField label="Status" required error={errors.status?.message}>
          <select className="form-select" {...register("status")}>
            <option value="PROMOTED">Promoted</option>
            <option value="REPEATED">Repeated</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="GRADUATED">Graduated</option>
          </select>
        </FormField>
        <FormField label="Promotion date" required error={errors.promotionDate?.message}>
          <input type="date" className="form-control" {...register("promotionDate")} />
        </FormField>
        <FormField label="Remarks (optional)" error={errors.remarks?.message}>
          <textarea className="form-control" rows={2} {...register("remarks")} />
        </FormField>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

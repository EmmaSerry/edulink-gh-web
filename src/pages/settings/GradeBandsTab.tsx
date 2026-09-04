import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { DataTable, type DataTableColumn } from "@components/DataTable";
import { StatusBadge } from "@components/StatusBadge";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { GradeBandService } from "@services/GradeBandService";
import { createGradeBandSchema, type GradeBandFormValues } from "@validation/gradeBandSchema";
import type { GradeBand } from "@models/GradeBand";

const EMPTY: GradeBandFormValues = {
  levelId: null,
  minScore: 0,
  maxScore: 100,
  label: "",
  code: "",
  sortOrder: 1,
  isActive: true,
};

export function GradeBandsTab() {
  const bands = useLiveQuery(() => GradeBandService.getAll(), []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GradeBand | null>(null);

  const schema = createGradeBandSchema(bands ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GradeBandFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const sortedBands = bands ? [...bands].sort((a, b) => b.minScore - a.minScore) : bands;

  const onSubmit = async (values: GradeBandFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await GradeBandService.update(editing.id, { ...values, updatedAt: now });
        showToast("Grade band updated.", "success");
      } else {
        await GradeBandService.create({ ...values, createdAt: now, updatedAt: now });
        showToast("Grade band created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the grade band.", "error");
    }
  };

  const onDelete = async (band: GradeBand) => {
    const ok = await confirm({ message: `Delete grade band "${band.label}"?`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await GradeBandService.remove(band.id!);
      showToast("Grade band deleted.", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not delete the grade band.", "error");
    }
  };

  const columns: DataTableColumn<GradeBand>[] = [
    { key: "range", header: "Score Range", render: (b) => <strong>{b.minScore}–{b.maxScore}</strong>, sortValue: (b) => b.minScore },
    { key: "label", header: "Grade Band", render: (b) => b.label },
    { key: "code", header: "Code", render: (b) => <code>{b.code}</code> },
    { key: "scope", header: "Scope", render: (b) => (b.levelId ? "Specific level" : "All scored levels") },
    { key: "isActive", header: "Status", render: (b) => <StatusBadge active={b.isActive} /> },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <p className="text-muted small mb-0">
          Default GES grading scale - editable if curriculum policy changes, with no code deployment required.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <i className="bi bi-plus-lg me-1" /> Add grade band
        </button>
      </div>
      <DataTable
        columns={columns}
        rows={sortedBands}
        getRowKey={(b) => b.id!}
        emptyTitle="No grade bands configured"
        emptyMessage="Add the 5-band GES scale: Advanced, Proficient, Approaching Proficiency, Developing, Beginning."
        rowActions={(b) => (
          <div className="btn-group btn-group-sm">
            <button className="btn btn-outline-secondary" onClick={() => { setEditing(b); setModalOpen(true); }}>
              <i className="bi bi-pencil" />
            </button>
            <button className="btn btn-outline-danger" onClick={() => onDelete(b)}>
              <i className="bi bi-trash" />
            </button>
          </div>
        )}
      />

      <Modal title={editing ? "Edit grade band" : "Add grade band"} isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Minimum score" required error={errors.minScore?.message}>
                <input type="number" className="form-control" {...register("minScore", { valueAsNumber: true })} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Maximum score" required error={errors.maxScore?.message}>
                <input type="number" className="form-control" {...register("maxScore", { valueAsNumber: true })} />
              </FormField>
            </div>
            <div className="col-md-8">
              <FormField label="Description" required error={errors.label?.message}>
                <input className="form-control" placeholder="Advanced" {...register("label")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Short code" required error={errors.code?.message}>
                <input className="form-control" placeholder="A" {...register("code")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Display order" required error={errors.sortOrder?.message}>
                <input type="number" className="form-control" {...register("sortOrder", { valueAsNumber: true })} />
              </FormField>
            </div>
          </div>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="bandActive" {...register("isActive")} />
            <label className="form-check-label small" htmlFor="bandActive">Active</label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Create grade band"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

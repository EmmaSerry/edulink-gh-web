import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { DataTable, type DataTableColumn } from "@components/DataTable";
import { StatusBadge } from "@components/StatusBadge";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { LearningAreaService } from "@services/LearningAreaService";
import { LevelService } from "@services/LevelService";
import { DeletionBlockedError } from "@services/AcademicYearService";
import { createLearningAreaSchema, type LearningAreaFormValues } from "@validation/learningAreaSchema";
import type { LearningArea } from "@models/LearningArea";

const EMPTY: LearningAreaFormValues = { name: "", sortOrder: 1, levelIds: [], isActive: true };

export function LearningAreasTab() {
  const areas = useLiveQuery(() => LearningAreaService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const kgLevels = levels?.filter((l) => l.assessmentMode === "skill-checklist");
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LearningArea | null>(null);

  const schema = createLearningAreaSchema(areas ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<LearningAreaFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const levelNames = (ids: number[]) => ids.map((id) => levels?.find((l) => l.id === id)?.code ?? "?").join(", ");

  const onSubmit = async (values: LearningAreaFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await LearningAreaService.update(editing.id, { ...values, updatedAt: now });
        showToast("Learning area updated.", "success");
      } else {
        await LearningAreaService.create({ ...values, createdAt: now, updatedAt: now });
        showToast("Learning area created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the learning area.", "error");
    }
  };

  const onDelete = async (area: LearningArea) => {
    const ok = await confirm({ message: `Delete "${area.name}"?`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await LearningAreaService.remove(area.id!);
      showToast("Learning area deleted.", "success");
    } catch (err) {
      if (err instanceof DeletionBlockedError) showToast(err.message, "error");
      else {
        console.error(err);
        showToast("Could not delete the learning area.", "error");
      }
    }
  };

  const columns: DataTableColumn<LearningArea>[] = [
    { key: "sortOrder", header: "#", render: (a) => a.sortOrder, sortValue: (a) => a.sortOrder, className: "text-muted" },
    { key: "name", header: "Learning Area", render: (a) => <strong>{a.name}</strong>, sortValue: (a) => a.name },
    { key: "levels", header: "Applicable KG Level(s)", render: (a) => <span className="small text-muted">{levelNames(a.levelIds)}</span> },
    { key: "isActive", header: "Status", render: (a) => <StatusBadge active={a.isActive} /> },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <p className="text-muted small mb-0">From the official NaCCA KG Assessment Tool - fully editable here.</p>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <i className="bi bi-plus-lg me-1" /> Add learning area
        </button>
      </div>
      <DataTable
        columns={columns}
        rows={areas}
        getRowKey={(a) => a.id!}
        searchValue={(a) => a.name}
        searchPlaceholder="Search learning areas…"
        emptyTitle="No learning areas yet"
        emptyMessage="Add Language & Literacy, Numeracy, Creative Arts, Our World Our People, Socio-Emotional Learning."
        rowActions={(a) => (
          <div className="btn-group btn-group-sm">
            <button className="btn btn-outline-secondary" onClick={() => { setEditing(a); setModalOpen(true); }}>
              <i className="bi bi-pencil" />
            </button>
            <button className="btn btn-outline-danger" onClick={() => onDelete(a)}>
              <i className="bi bi-trash" />
            </button>
          </div>
        )}
      />

      <Modal title={editing ? "Edit learning area" : "Add learning area"} isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Learning area name" required error={errors.name?.message}>
            <input className="form-control" placeholder="Numeracy" {...register("name")} />
          </FormField>
          <FormField label="Applicable KG level(s)" required error={errors.levelIds?.message}>
            <Controller
              control={control}
              name="levelIds"
              render={({ field }) => (
                <div className="d-flex flex-wrap gap-2">
                  {kgLevels?.map((l) => {
                    const checked = field.value.includes(l.id!);
                    return (
                      <label key={l.id} className="form-check form-check-inline border rounded-2 px-2 py-1 small">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...field.value, l.id!] : field.value.filter((id) => id !== l.id);
                            field.onChange(next);
                          }}
                        />
                        {l.name}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </FormField>
          <FormField label="Display order" required error={errors.sortOrder?.message}>
            <input type="number" className="form-control" {...register("sortOrder", { valueAsNumber: true })} />
          </FormField>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="areaActive" {...register("isActive")} />
            <label className="form-check-label small" htmlFor="areaActive">Active</label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Create learning area"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

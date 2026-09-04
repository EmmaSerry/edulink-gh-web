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
import { SubjectService } from "@services/SubjectService";
import { LevelService } from "@services/LevelService";
import { DeletionBlockedError } from "@services/AcademicYearService";
import { createSubjectSchema, type SubjectFormValues } from "@validation/subjectSchema";
import type { Subject } from "@models/Subject";

const EMPTY: SubjectFormValues = { name: "", code: "", shortName: "", sortOrder: 1, levelIds: [], isActive: true };

export function SubjectsTab() {
  const subjects = useLiveQuery(() => SubjectService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  const schema = createSubjectSchema(subjects ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<SubjectFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const levelNames = (ids: number[]) =>
    ids.map((id) => levels?.find((l) => l.id === id)?.code ?? "?").join(", ");

  const onSubmit = async (values: SubjectFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await SubjectService.update(editing.id, { ...values, updatedAt: now });
        showToast("Subject updated.", "success");
      } else {
        await SubjectService.create({ ...values, createdAt: now, updatedAt: now });
        showToast("Subject created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the subject.", "error");
    }
  };

  const onDelete = async (subject: Subject) => {
    const ok = await confirm({ message: `Delete subject "${subject.name}"?`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await SubjectService.remove(subject.id!);
      showToast("Subject deleted.", "success");
    } catch (err) {
      if (err instanceof DeletionBlockedError) showToast(err.message, "error");
      else {
        console.error(err);
        showToast("Could not delete the subject.", "error");
      }
    }
  };

  const columns: DataTableColumn<Subject>[] = [
    { key: "sortOrder", header: "#", render: (s) => s.sortOrder, sortValue: (s) => s.sortOrder, className: "text-muted" },
    { key: "name", header: "Subject", render: (s) => <strong>{s.name}</strong>, sortValue: (s) => s.name },
    { key: "code", header: "Code", render: (s) => <code>{s.code}</code> },
    { key: "levels", header: "Applicable Levels", render: (s) => <span className="small text-muted">{levelNames(s.levelIds)}</span> },
    { key: "isActive", header: "Status", render: (s) => <StatusBadge active={s.isActive} /> },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <p className="text-muted small mb-0">
          Subjects are shared across whichever levels you select - no need to duplicate "Science" per level.
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <i className="bi bi-plus-lg me-1" /> Add subject
        </button>
      </div>
      <DataTable
        columns={columns}
        rows={subjects}
        getRowKey={(s) => s.id!}
        searchValue={(s) => `${s.name} ${s.code}`}
        searchPlaceholder="Search subjects…"
        emptyTitle="No subjects yet"
        emptyMessage="Add subjects for Lower Primary, Upper Primary and JHS."
        rowActions={(s) => (
          <div className="btn-group btn-group-sm">
            <button className="btn btn-outline-secondary" onClick={() => { setEditing(s); setModalOpen(true); }}>
              <i className="bi bi-pencil" />
            </button>
            <button className="btn btn-outline-danger" onClick={() => onDelete(s)}>
              <i className="bi bi-trash" />
            </button>
          </div>
        )}
      />

      <Modal title={editing ? "Edit subject" : "Add subject"} isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Subject name" required error={errors.name?.message}>
                <input className="form-control" {...register("name")} />
              </FormField>
            </div>
            <div className="col-md-3">
              <FormField label="Code" required error={errors.code?.message}>
                <input className="form-control" {...register("code")} />
              </FormField>
            </div>
            <div className="col-md-3">
              <FormField label="Short name" required error={errors.shortName?.message}>
                <input className="form-control" {...register("shortName")} />
              </FormField>
            </div>
          </div>
          <FormField label="Applicable levels" required error={errors.levelIds?.message}>
            <Controller
              control={control}
              name="levelIds"
              render={({ field }) => (
                <div className="d-flex flex-wrap gap-2">
                  {levels?.filter((l) => l.assessmentMode === "scored").map((l) => {
                    const checked = field.value.includes(l.id!);
                    return (
                      <label key={l.id} className="form-check form-check-inline border rounded-2 px-2 py-1 small">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...field.value, l.id!]
                              : field.value.filter((id) => id !== l.id);
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
            <input className="form-check-input" type="checkbox" id="subjectActive" {...register("isActive")} />
            <label className="form-check-label small" htmlFor="subjectActive">Active</label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Create subject"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

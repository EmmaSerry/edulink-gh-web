import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { DataTable, type DataTableColumn } from "@components/DataTable";
import { StatusBadge } from "@components/StatusBadge";
import { EmptyState } from "@components/EmptyState";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { SkillService } from "@services/SkillService";
import { LearningAreaService } from "@services/LearningAreaService";
import { LevelService } from "@services/LevelService";
import { DeletionBlockedError } from "@services/AcademicYearService";
import { createSkillSchema, type SkillFormValues } from "@validation/skillSchema";
import type { Skill } from "@models/Skill";

const EMPTY: SkillFormValues = {
  learningAreaId: 0,
  levelId: 0,
  serialNumber: 1,
  description: "",
  sortOrder: 1,
  isActive: true,
};

export function SkillsTab() {
  const skills = useLiveQuery(() => SkillService.getAll(), []);
  const areas = useLiveQuery(() => LearningAreaService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const kgLevels = levels?.filter((l) => l.assessmentMode === "skill-checklist");
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");

  const schema = createSkillSchema(skills ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SkillFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const areaName = (id: number) => areas?.find((a) => a.id === id)?.name ?? "—";
  const levelCode = (id: number) => levels?.find((l) => l.id === id)?.code ?? "—";

  const visibleSkills = skills?.filter((s) => levelFilter === "all" || s.levelId === levelFilter);

  const onSubmit = async (values: SkillFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await SkillService.update(editing.id, { ...values, updatedAt: now });
        showToast("Skill updated.", "success");
      } else {
        await SkillService.create({ ...values, createdAt: now, updatedAt: now });
        showToast("Skill created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the skill.", "error");
    }
  };

  const onDelete = async (skill: Skill) => {
    const ok = await confirm({ message: `Delete this skill?`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await SkillService.remove(skill.id!);
      showToast("Skill deleted.", "success");
    } catch (err) {
      if (err instanceof DeletionBlockedError) showToast(err.message, "error");
      else {
        console.error(err);
        showToast("Could not delete the skill.", "error");
      }
    }
  };

  if (areas && areas.length === 0) {
    return (
      <EmptyState
        icon="bi-list-check"
        title="Create a learning area first"
        message="Skills belong to a learning area. Add one in the Learning Areas tab, then return here."
      />
    );
  }

  const columns: DataTableColumn<Skill>[] = [
    { key: "sn", header: "S/N", render: (s) => s.serialNumber, sortValue: (s) => s.serialNumber, className: "text-muted" },
    { key: "level", header: "Level", render: (s) => <span className="badge text-bg-light border">{levelCode(s.levelId)}</span> },
    { key: "area", header: "Learning Area", render: (s) => areaName(s.learningAreaId) },
    { key: "description", header: "Skill Description", render: (s) => s.description },
    { key: "isActive", header: "Status", render: (s) => <StatusBadge active={s.isActive} /> },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <p className="text-muted small mb-0">
          Teachers never need to edit code when NaCCA updates the skill list - update it here instead.
        </p>
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 160 }}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">All KG levels</option>
            {kgLevels?.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <i className="bi bi-plus-lg me-1" /> Add skill
          </button>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={visibleSkills}
        getRowKey={(s) => s.id!}
        searchValue={(s) => s.description}
        searchPlaceholder="Search skills…"
        emptyTitle="No skills yet"
        emptyMessage="Add the NaCCA checklist skills for this learning area and KG level."
        pageSize={8}
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

      <Modal title={editing ? "Edit skill" : "Add skill"} isOpen={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Learning area" required error={errors.learningAreaId?.message}>
                <select className="form-select" {...register("learningAreaId", { valueAsNumber: true })}>
                  <option value={0}>Select…</option>
                  {areas?.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="KG level" required error={errors.levelId?.message}>
                <select className="form-select" {...register("levelId", { valueAsNumber: true })}>
                  <option value={0}>Select…</option>
                  {kgLevels?.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="col-md-3">
              <FormField label="Skill number (S/N)" required error={errors.serialNumber?.message}>
                <input type="number" className="form-control" {...register("serialNumber", { valueAsNumber: true })} />
              </FormField>
            </div>
            <div className="col-md-3">
              <FormField label="Display order" required error={errors.sortOrder?.message}>
                <input type="number" className="form-control" {...register("sortOrder", { valueAsNumber: true })} />
              </FormField>
            </div>
            <div className="col-md-6 d-flex align-items-end">
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="skillActive" {...register("isActive")} />
                <label className="form-check-label small" htmlFor="skillActive">Active</label>
              </div>
            </div>
          </div>
          <FormField label="Skill description" required error={errors.description?.message}>
            <textarea className="form-control" rows={3} {...register("description")} />
          </FormField>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Create skill"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

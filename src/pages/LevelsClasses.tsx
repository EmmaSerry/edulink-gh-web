import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { DataTable, type DataTableColumn } from "@components/DataTable";
import { Breadcrumb } from "@components/Breadcrumb";
import { StatusBadge } from "@components/StatusBadge";
import { EmptyState } from "@components/EmptyState";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { LevelService } from "@services/LevelService";
import { ClassRegisterTab } from "./students/ClassRegisterTab";
import { ClassService } from "@services/ClassService";
import { DeletionBlockedError } from "@services/AcademicYearService";
import { createLevelSchema, type LevelFormValues } from "@validation/levelSchema";
import { createClassSchema, type ClassFormValues } from "@validation/classSchema";
import type { Level } from "@models/Level";
import type { SchoolClass } from "@models/SchoolClass";

const EMPTY_LEVEL: LevelFormValues = {
  code: "",
  name: "",
  assessmentMode: "scored",
  sortOrder: 1,
  isActive: true,
};

const EMPTY_CLASS: ClassFormValues = {
  levelId: 0,
  name: "",
  code: "",
  capacity: undefined,
  classTeacherName: "",
  isActive: true,
};

function LevelsTab() {
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Level | null>(null);

  const schema = createLevelSchema(levels ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LevelFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_LEVEL });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY_LEVEL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const onSubmit = async (values: LevelFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await LevelService.update(editing.id, { ...values, updatedAt: now });
        showToast("Level updated.", "success");
      } else {
        await LevelService.create({ ...values, createdAt: now, updatedAt: now });
        showToast("Level created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the level.", "error");
    }
  };

  const onDelete = async (level: Level) => {
    const ok = await confirm({
      message: `Delete level "${level.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await LevelService.remove(level.id!);
      showToast("Level deleted.", "success");
    } catch (err) {
      if (err instanceof DeletionBlockedError) showToast(err.message, "error");
      else {
        console.error(err);
        showToast("Could not delete the level.", "error");
      }
    }
  };

  const columns: DataTableColumn<Level>[] = [
    { key: "sortOrder", header: "#", render: (l) => l.sortOrder, sortValue: (l) => l.sortOrder, className: "text-muted" },
    { key: "name", header: "Level", render: (l) => <strong>{l.name}</strong>, sortValue: (l) => l.sortOrder },
    { key: "code", header: "Code", render: (l) => <code>{l.code}</code> },
    {
      key: "mode",
      header: "Assessment Mode",
      render: (l) => (
        <span className={`badge ${l.assessmentMode === "scored" ? "text-bg-info" : "text-bg-warning"}`}>
          {l.assessmentMode === "scored" ? "Scored" : "Skill Checklist"}
        </span>
      ),
    },
    { key: "isActive", header: "Status", render: (l) => <StatusBadge active={l.isActive} /> },
  ];

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <i className="bi bi-plus-lg me-1" /> Add level
        </button>
      </div>
      <DataTable
        columns={columns}
        rows={levels}
        getRowKey={(l) => l.id!}
        searchValue={(l) => `${l.name} ${l.code}`}
        searchPlaceholder="Search levels…"
        emptyTitle="No levels yet"
        emptyMessage="Add KG1, KG2, Basic 1-6 or JHS1-3 to get started."
        rowActions={(l) => (
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                setEditing(l);
                setModalOpen(true);
              }}
            >
              <i className="bi bi-pencil" />
            </button>
            <button className="btn btn-outline-danger" onClick={() => onDelete(l)}>
              <i className="bi bi-trash" />
            </button>
          </div>
        )}
      />

      <Modal title={editing ? "Edit level" : "Add level"} isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Level code" required error={errors.code?.message}>
                <input className="form-control" placeholder="KG1" {...register("code")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Level name" required error={errors.name?.message}>
                <input className="form-control" placeholder="Kindergarten 1" {...register("name")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Assessment mode" required error={errors.assessmentMode?.message}>
                <select className="form-select" {...register("assessmentMode")}>
                  <option value="scored">Scored (SBA + Exam)</option>
                  <option value="skill-checklist">Skill Checklist (Gold/Silver/Bronze)</option>
                </select>
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Display order" required error={errors.sortOrder?.message}>
                <input type="number" className="form-control" {...register("sortOrder", { valueAsNumber: true })} />
              </FormField>
            </div>
          </div>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="levelActive" {...register("isActive")} />
            <label className="form-check-label small" htmlFor="levelActive">
              Active
            </label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editing ? "Save changes" : "Create level"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ClassesTab() {
  const classes = useLiveQuery(() => ClassService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);

  const schema = createClassSchema(classes ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_CLASS });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY_CLASS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const levelName = (id: number) => levels?.find((l) => l.id === id)?.name ?? "—";

  const onSubmit = async (values: ClassFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await ClassService.update(editing.id, { ...values, updatedAt: now });
        showToast("Class updated.", "success");
      } else {
        await ClassService.create({ ...values, createdAt: now, updatedAt: now });
        showToast("Class created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the class.", "error");
    }
  };

  const onDelete = async (cls: SchoolClass) => {
    const ok = await confirm({
      message: `Delete class "${cls.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await ClassService.remove(cls.id!);
      showToast("Class deleted.", "success");
    } catch (err) {
      if (err instanceof DeletionBlockedError) showToast(err.message, "error");
      else {
        console.error(err);
        showToast("Could not delete the class.", "error");
      }
    }
  };

  if (levels && levels.length === 0) {
    return (
      <EmptyState
        icon="bi-layers"
        title="Create a level first"
        message="Classes belong to a level. Switch to the Levels tab and add one, then come back here to add its classes."
      />
    );
  }

  const columns: DataTableColumn<SchoolClass>[] = [
    { key: "name", header: "Class", render: (c) => <strong>{c.name}</strong>, sortValue: (c) => c.name },
    { key: "code", header: "Code", render: (c) => <code>{c.code}</code> },
    { key: "level", header: "Level", render: (c) => levelName(c.levelId) },
    { key: "capacity", header: "Capacity", render: (c) => c.capacity ?? "—" },
    { key: "teacher", header: "Class Teacher", render: (c) => c.classTeacherName || "—" },
    { key: "isActive", header: "Status", render: (c) => <StatusBadge active={c.isActive} /> },
  ];

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <i className="bi bi-plus-lg me-1" /> Add class
        </button>
      </div>
      <DataTable
        columns={columns}
        rows={classes}
        getRowKey={(c) => c.id!}
        searchValue={(c) => `${c.name} ${c.code}`}
        searchPlaceholder="Search classes…"
        emptyTitle="No classes yet"
        emptyMessage="Add classes such as KG1 A or Basic 4 A."
        rowActions={(c) => (
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                setEditing(c);
                setModalOpen(true);
              }}
            >
              <i className="bi bi-pencil" />
            </button>
            <button className="btn btn-outline-danger" onClick={() => onDelete(c)}>
              <i className="bi bi-trash" />
            </button>
          </div>
        )}
      />

      <Modal title={editing ? "Edit class" : "Add class"} isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Level" required error={errors.levelId?.message}>
            <select className="form-select" {...register("levelId", { valueAsNumber: true })}>
              <option value={0}>Select…</option>
              {levels?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Class name" required error={errors.name?.message}>
                <input className="form-control" placeholder="KG1 A" {...register("name")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Class code" required error={errors.code?.message}>
                <input className="form-control" placeholder="KG1-A" {...register("code")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Capacity (optional)" error={errors.capacity?.message}>
                <input type="number" className="form-control" {...register("capacity", { valueAsNumber: true })} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Class teacher (optional)" error={errors.classTeacherName?.message}>
                <input className="form-control" {...register("classTeacherName")} />
              </FormField>
            </div>
          </div>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="classActive" {...register("isActive")} />
            <label className="form-check-label small" htmlFor="classActive">
              Active
            </label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editing ? "Save changes" : "Create class"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function LevelsClasses() {
  const [tab, setTab] = useState<"levels" | "classes" | "register">("levels");

  return (
    <>
      <Breadcrumb items={[{ label: "Levels & Classes" }]} />
      <PageHeader
        title="Levels & Classes"
        description="Configure the education levels the school runs and the classes within each level."
      />
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === "levels" ? "active" : ""}`} onClick={() => setTab("levels")}>
            Levels
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}>
            Classes
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
            Class Register
          </button>
        </li>
      </ul>
      <Card>
        {tab === "levels" && <LevelsTab />}
        {tab === "classes" && <ClassesTab />}
        {tab === "register" && <ClassRegisterTab />}
      </Card>
    </>
  );
}

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
import { TermService } from "@services/TermService";
import { DeletionBlockedError } from "@services/AcademicYearService";
import { AcademicYearService } from "@services/AcademicYearService";
import { createTermSchema, type TermFormValues } from "@validation/termSchema";
import type { Term } from "@models/Term";
import { formatDateForDisplay } from "@utils/dateUtils";

const EMPTY: TermFormValues = {
  academicYearId: 0,
  termName: "",
  termNumber: 1,
  openingDate: "",
  closingDate: "",
  vacationDate: "",
  reopeningDate: "",
  totalSchoolDays: 60,
  isActive: false,
};

export function Terms() {
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const academicYears = useLiveQuery(() => AcademicYearService.getAll(), []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);

  const schema = createTermSchema(terms ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TermFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const yearLabel = (id: number) => academicYears?.find((y) => y.id === id)?.label ?? "—";

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (term: Term) => {
    setEditing(term);
    setModalOpen(true);
  };

  const onSubmit = async (values: TermFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await TermService.update(editing.id, { ...values, updatedAt: now });
        if (values.isActive) await TermService.setActive(editing.id);
        showToast("Term updated.", "success");
      } else {
        const id = await TermService.create({ ...values, createdAt: now, updatedAt: now });
        if (values.isActive) await TermService.setActive(id as number);
        showToast("Term created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the term.", "error");
    }
  };

  const onDelete = async (term: Term) => {
    const ok = await confirm({
      message: `Delete "${term.termName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await TermService.remove(term.id!);
      showToast("Term deleted.", "success");
    } catch (err) {
      if (err instanceof DeletionBlockedError) {
        showToast(err.message, "error");
      } else {
        console.error(err);
        showToast("Could not delete the term.", "error");
      }
    }
  };

  const columns: DataTableColumn<Term>[] = [
    { key: "termName", header: "Term", render: (t) => <strong>{t.termName}</strong>, sortValue: (t) => t.termNumber },
    { key: "year", header: "Academic Year", render: (t) => yearLabel(t.academicYearId) },
    { key: "opening", header: "Opening", render: (t) => formatDateForDisplay(t.openingDate) },
    { key: "closing", header: "Closing", render: (t) => formatDateForDisplay(t.closingDate) },
    { key: "days", header: "School Days", render: (t) => t.totalSchoolDays, sortValue: (t) => t.totalSchoolDays },
    {
      key: "isActive",
      header: "Status",
      render: (t) => (t.isActive ? <span className="badge text-bg-primary">Active</span> : <StatusBadge active={false} />),
    },
  ];

  if (academicYears && academicYears.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Terms" }]} />
        <PageHeader title="Terms" description="Term configuration: dates and attendance days." />
        <Card>
          <EmptyState
            icon="bi-calendar-x"
            title="Create an academic year first"
            message="Terms belong to an academic year. Go to Academic Years and add one, then come back here to add its terms."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Terms" }]} />
      <PageHeader
        title="Terms"
        description="Term configuration: dates and attendance days. Only one term may be active at a time."
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" /> Add term
          </button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={terms}
          getRowKey={(t) => t.id!}
          searchValue={(t) => `${t.termName} ${yearLabel(t.academicYearId)}`}
          searchPlaceholder="Search terms…"
          emptyTitle="No terms yet"
          emptyMessage="Add the first term for the current academic year."
          rowActions={(t) => (
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" onClick={() => openEdit(t)}>
                <i className="bi bi-pencil" />
              </button>
              <button className="btn btn-outline-danger" onClick={() => onDelete(t)}>
                <i className="bi bi-trash" />
              </button>
            </div>
          )}
        />
      </Card>

      <Modal title={editing ? "Edit term" : "Add term"} isOpen={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Academic year" required error={errors.academicYearId?.message}>
                <select className="form-select" {...register("academicYearId", { valueAsNumber: true })}>
                  <option value={0}>Select…</option>
                  {academicYears?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Term number" required error={errors.termNumber?.message}>
                <select className="form-select" {...register("termNumber", { valueAsNumber: true })}>
                  <option value={1}>Term 1</option>
                  <option value={2}>Term 2</option>
                  <option value={3}>Term 3</option>
                </select>
              </FormField>
            </div>
            <div className="col-12">
              <FormField label="Term name" required error={errors.termName?.message}>
                <input className="form-control" placeholder="Term 1" {...register("termName")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Opening date" required error={errors.openingDate?.message}>
                <input type="date" className="form-control" {...register("openingDate")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Closing date" required error={errors.closingDate?.message}>
                <input type="date" className="form-control" {...register("closingDate")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Vacation date" required error={errors.vacationDate?.message}>
                <input type="date" className="form-control" {...register("vacationDate")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Reopening date" required error={errors.reopeningDate?.message}>
                <input type="date" className="form-control" {...register("reopeningDate")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Total school days" required error={errors.totalSchoolDays?.message}>
                <input
                  type="number"
                  className="form-control"
                  {...register("totalSchoolDays", { valueAsNumber: true })}
                />
              </FormField>
            </div>
          </div>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="isActiveTerm" {...register("isActive")} />
            <label className="form-check-label small" htmlFor="isActiveTerm">
              Set as the active term
            </label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editing ? "Save changes" : "Create term"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

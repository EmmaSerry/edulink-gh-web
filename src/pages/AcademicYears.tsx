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
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { AcademicYearService, DeletionBlockedError } from "@services/AcademicYearService";
import { createAcademicYearSchema, type AcademicYearFormValues } from "@validation/academicYearSchema";
import type { AcademicYear } from "@models/AcademicYear";
import { formatDateForDisplay } from "@utils/dateUtils";

const EMPTY: AcademicYearFormValues = { label: "", startDate: "", endDate: "", isCurrent: false };

export function AcademicYears() {
  const years = useLiveQuery(() => AcademicYearService.getAll(), []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);

  const schema = createAcademicYearSchema(years ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AcademicYearFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (year: AcademicYear) => {
    setEditing(year);
    setModalOpen(true);
  };

  const onSubmit = async (values: AcademicYearFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await AcademicYearService.update(editing.id, { ...values, updatedAt: now });
        if (values.isCurrent) await AcademicYearService.setCurrent(editing.id);
        showToast("Academic year updated.", "success");
      } else {
        const id = await AcademicYearService.create({
          ...values,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        if (values.isCurrent) await AcademicYearService.setCurrent(id as number);
        showToast("Academic year created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the academic year.", "error");
    }
  };

  const onDelete = async (year: AcademicYear) => {
    const ok = await confirm({
      message: `Delete academic year "${year.label}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await AcademicYearService.remove(year.id!);
      showToast("Academic year deleted.", "success");
    } catch (err) {
      if (err instanceof DeletionBlockedError) {
        showToast(err.message, "error");
      } else {
        console.error(err);
        showToast("Could not delete the academic year.", "error");
      }
    }
  };

  const columns: DataTableColumn<AcademicYear>[] = [
    { key: "label", header: "Academic Year", render: (y) => <strong>{y.label}</strong>, sortValue: (y) => y.label },
    { key: "startDate", header: "Start", render: (y) => formatDateForDisplay(y.startDate), sortValue: (y) => y.startDate },
    { key: "endDate", header: "End", render: (y) => formatDateForDisplay(y.endDate), sortValue: (y) => y.endDate },
    {
      key: "isCurrent",
      header: "Current",
      render: (y) => (y.isCurrent ? <span className="badge text-bg-primary">Current</span> : <span className="text-muted">—</span>),
    },
    { key: "isActive", header: "Status", render: (y) => <StatusBadge active={y.isActive} /> },
  ];

  return (
    <>
      <Breadcrumb items={[{ label: "Academic Years" }]} />
      <PageHeader
        title="Academic Years"
        description="Manage the academic years available to the system, e.g. 2025/2026."
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" /> Add academic year
          </button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={years}
          getRowKey={(y) => y.id!}
          searchValue={(y) => y.label}
          searchPlaceholder="Search academic years…"
          emptyTitle="No academic years yet"
          emptyMessage="Add your first academic year, e.g. 2025/2026."
          rowActions={(y) => (
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" onClick={() => openEdit(y)}>
                <i className="bi bi-pencil" />
              </button>
              <button className="btn btn-outline-danger" onClick={() => onDelete(y)}>
                <i className="bi bi-trash" />
              </button>
            </div>
          )}
        />
      </Card>

      <Modal
        title={editing ? "Edit academic year" : "Add academic year"}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Academic year" required hint="Format: YYYY/YYYY" error={errors.label?.message}>
            <input className="form-control" placeholder="2025/2026" {...register("label")} />
          </FormField>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Start date" required error={errors.startDate?.message}>
                <input type="date" className="form-control" {...register("startDate")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="End date" required error={errors.endDate?.message}>
                <input type="date" className="form-control" {...register("endDate")} />
              </FormField>
            </div>
          </div>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="isCurrent" {...register("isCurrent")} />
            <label className="form-check-label small" htmlFor="isCurrent">
              Set as the current academic year
            </label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editing ? "Save changes" : "Create academic year"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

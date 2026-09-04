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
import { RemarksBankService } from "@services/RemarksBankService";
import { createRemarksBankSchema, type RemarksBankFormValues } from "@validation/remarksBankSchema";
import { REMARKS_CATEGORY_LABELS, type RemarksBankEntry } from "@models/RemarksBank";

const EMPTY: RemarksBankFormValues = { category: "INTEREST", text: "", sortOrder: 1, isActive: true };

export function RemarksBankTab() {
  const remarks = useLiveQuery(() => RemarksBankService.getAll(), []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RemarksBankEntry | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const schema = createRemarksBankSchema(remarks ?? [], editing?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RemarksBankFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    reset(editing ? { ...editing } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, modalOpen]);

  const visible = remarks?.filter((r) => categoryFilter === "all" || r.category === categoryFilter);

  const onSubmit = async (values: RemarksBankFormValues) => {
    try {
      const now = new Date().toISOString();
      if (editing?.id) {
        await RemarksBankService.update(editing.id, { ...values, updatedAt: now });
        showToast("Remark updated.", "success");
      } else {
        await RemarksBankService.create({ ...values, createdAt: now, updatedAt: now });
        showToast("Remark created.", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Could not save the remark.", "error");
    }
  };

  const onDelete = async (entry: RemarksBankEntry) => {
    const ok = await confirm({ message: `Delete this remark?`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await RemarksBankService.remove(entry.id!);
      showToast("Remark deleted.", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not delete the remark.", "error");
    }
  };

  const columns: DataTableColumn<RemarksBankEntry>[] = [
    {
      key: "category",
      header: "Category",
      render: (r) => <span className="badge text-bg-light border">{REMARKS_CATEGORY_LABELS[r.category]}</span>,
    },
    { key: "text", header: "Remark Text", render: (r) => r.text, sortValue: (r) => r.text },
    { key: "sortOrder", header: "Order", render: (r) => r.sortOrder, sortValue: (r) => r.sortOrder },
    { key: "isActive", header: "Status", render: (r) => <StatusBadge active={r.isActive} /> },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <p className="text-muted small mb-0">No hard-coded remarks - every phrase here is editable.</p>
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 190 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {Object.entries(REMARKS_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <i className="bi bi-plus-lg me-1" /> Add remark
          </button>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={visible}
        getRowKey={(r) => r.id!}
        searchValue={(r) => r.text}
        searchPlaceholder="Search remarks…"
        emptyTitle="No remarks yet"
        emptyMessage="Add phrases for Conduct, Interest, Attitude, Teacher Remarks and Headteacher Remarks."
        rowActions={(r) => (
          <div className="btn-group btn-group-sm">
            <button className="btn btn-outline-secondary" onClick={() => { setEditing(r); setModalOpen(true); }}>
              <i className="bi bi-pencil" />
            </button>
            <button className="btn btn-outline-danger" onClick={() => onDelete(r)}>
              <i className="bi bi-trash" />
            </button>
          </div>
        )}
      />

      <Modal title={editing ? "Edit remark" : "Add remark"} isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Category" required error={errors.category?.message}>
            <select className="form-select" {...register("category")}>
              {Object.entries(REMARKS_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Remark text" required error={errors.text?.message}>
            <textarea className="form-control" rows={2} {...register("text")} />
          </FormField>
          <FormField label="Display order" required error={errors.sortOrder?.message}>
            <input type="number" className="form-control" {...register("sortOrder", { valueAsNumber: true })} />
          </FormField>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="remarkActive" {...register("isActive")} />
            <label className="form-check-label small" htmlFor="remarkActive">Active</label>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Create remark"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

import { useState } from "react";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { useToast } from "@contexts/ToastContext";
import { StudentService } from "@services/StudentService";
import type { Student, StudentStatus } from "@models/Student";

const STATUS_OPTIONS: Array<{ value: StudentStatus; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "TRANSFERRED_OUT", label: "Transferred Out" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "DECEASED", label: "Deceased" },
];

interface Props {
  student: Student | null;
  onClose: () => void;
  onDone?: () => void;
}

/** "Update Status" (Module 1) - the module's soft-delete mechanism.
 *  There is intentionally no hard-delete action anywhere in the Students
 *  UI; every status other than ACTIVE just hides the student from
 *  default active views while keeping the full record. */
export function StatusChangeModal({ student, onClose, onDone }: Props) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<StudentStatus>(student?.status ?? "ACTIVE");
  const [reason, setReason] = useState("");

  if (!student) return null;

  const onSubmit = async () => {
    try {
      await StudentService.updateStatus(student.id!, status, reason || undefined);
      showToast("Student status updated.", "success");
      onDone?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("Could not update status.", "error");
    }
  };

  return (
    <Modal title="Update status" isOpen={!!student} onClose={onClose}>
      <FormField label="Status" required>
        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Reason / remarks (optional)">
        <textarea className="form-control" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onSubmit}>Save</button>
      </div>
    </Modal>
  );
}

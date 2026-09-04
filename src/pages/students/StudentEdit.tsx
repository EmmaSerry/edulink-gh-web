import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { FormField } from "@components/FormField";
import { Breadcrumb } from "@components/Breadcrumb";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { StudentService } from "@services/StudentService";
import { GuardianService } from "@services/GuardianService";
import { createStudentEditSchema, type StudentEditFormValues } from "@validation/studentSchema";
import { getFullName } from "@models/Student";

export function StudentEdit() {
  const { id } = useParams();
  const studentId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const students = useLiveQuery(() => StudentService.getAll(), []);
  const student = useLiveQuery(() => StudentService.getById(studentId), [studentId]);
  const guardian = useLiveQuery(() => GuardianService.getByStudentId(studentId), [studentId]);

  const schema = createStudentEditSchema(students ?? [], studentId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentEditFormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (student) {
      reset({
        admissionNumber: student.admissionNumber ?? "",
        emisNumber: student.emisNumber ?? "",
        ghanaCardNumber: student.ghanaCardNumber ?? "",
        firstName: student.firstName,
        middleName: student.middleName ?? "",
        lastName: student.lastName,
        preferredName: student.preferredName ?? "",
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        nationality: student.nationality,
        specialEducationalNeeds: student.specialEducationalNeeds ?? "",
        academicYearOfAdmissionId: student.academicYearOfAdmissionId,
        admissionDate: student.admissionDate ?? "",
        previousSchool: student.previousSchool ?? "",
        boardingStatus: student.boardingStatus ?? "Day",
        guardianFullName: guardian?.fullName ?? "",
        guardianRelationship: guardian?.relationship ?? "",
        guardianPhone: guardian?.phone ?? "",
        guardianAlternativePhone: guardian?.alternativePhone ?? "",
        guardianEmail: guardian?.email ?? "",
        guardianOccupation: guardian?.occupation ?? "",
        guardianResidentialAddress: guardian?.residentialAddress ?? "",
        guardianDigitalAddress: guardian?.digitalAddress ?? "",
        guardianEmergencyContactName: guardian?.emergencyContactName ?? "",
        guardianEmergencyContactPhone: guardian?.emergencyContactPhone ?? "",
        status: student.status,
      });
    }
  }, [student, guardian, reset]);

  if (student === undefined) return <LoadingSpinner />;

  const onSubmit = async (values: StudentEditFormValues) => {
    try {
      await StudentService.updateStudent(studentId, {
        admissionNumber: values.admissionNumber || undefined,
        emisNumber: values.emisNumber || undefined,
        ghanaCardNumber: values.ghanaCardNumber || undefined,
        firstName: values.firstName,
        middleName: values.middleName || undefined,
        lastName: values.lastName,
        preferredName: values.preferredName || undefined,
        gender: values.gender,
        dateOfBirth: values.dateOfBirth,
        nationality: values.nationality,
        specialEducationalNeeds: values.specialEducationalNeeds || undefined,
        academicYearOfAdmissionId: values.academicYearOfAdmissionId,
        admissionDate: values.admissionDate || undefined,
        previousSchool: values.previousSchool || undefined,
        boardingStatus: values.boardingStatus,
        status: values.status,
      });
      await GuardianService.upsertForStudent(studentId, {
        fullName: values.guardianFullName,
        relationship: values.guardianRelationship,
        phone: values.guardianPhone,
        alternativePhone: values.guardianAlternativePhone || undefined,
        email: values.guardianEmail || undefined,
        occupation: values.guardianOccupation || undefined,
        residentialAddress: values.guardianResidentialAddress || undefined,
        digitalAddress: values.guardianDigitalAddress || undefined,
        emergencyContactName: values.guardianEmergencyContactName || undefined,
        emergencyContactPhone: values.guardianEmergencyContactPhone || undefined,
      });
      showToast("Student record updated.", "success");
      navigate(`/students/${studentId}`);
    } catch (err) {
      console.error(err);
      showToast("Could not save changes.", "error");
    }
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Students", path: "/students" },
          { label: getFullName(student), path: `/students/${studentId}` },
          { label: "Edit" },
        ]}
      />
      <PageHeader title={`Edit ${getFullName(student)}`} description="Class placement is edited from the student profile, not here." />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="mb-4">
          <h2 className="h6 mb-3">Personal information</h2>
          <div className="row">
            <div className="col-md-4">
              <FormField label="First name" required error={errors.firstName?.message}>
                <input className="form-control" {...register("firstName")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Middle name" error={errors.middleName?.message}>
                <input className="form-control" {...register("middleName")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Last name" required error={errors.lastName?.message}>
                <input className="form-control" {...register("lastName")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Gender" required error={errors.gender?.message}>
                <select className="form-select" {...register("gender")}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Date of birth" required error={errors.dateOfBirth?.message}>
                <input type="date" className="form-control" {...register("dateOfBirth")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Nationality" required error={errors.nationality?.message}>
                <input className="form-control" {...register("nationality")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Admission number (optional)" error={errors.admissionNumber?.message}>
                <input className="form-control" {...register("admissionNumber")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="EMIS number" error={errors.emisNumber?.message}>
                <input className="form-control" {...register("emisNumber")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Status" required error={errors.status?.message}>
                <select className="form-select" {...register("status")}>
                  <option value="ACTIVE">Active</option>
                  <option value="TRANSFERRED_OUT">Transferred Out</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                  <option value="DECEASED">Deceased</option>
                </select>
              </FormField>
            </div>
          </div>
        </Card>

        <Card className="mb-4">
          <h2 className="h6 mb-3">Parent / guardian information</h2>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Parent/guardian name" required error={errors.guardianFullName?.message}>
                <input className="form-control" {...register("guardianFullName")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Relationship" required error={errors.guardianRelationship?.message}>
                <input className="form-control" {...register("guardianRelationship")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Phone number" required error={errors.guardianPhone?.message}>
                <input className="form-control" {...register("guardianPhone")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Email" error={errors.guardianEmail?.message}>
                <input className="form-control" {...register("guardianEmail")} />
              </FormField>
            </div>
          </div>
        </Card>

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}

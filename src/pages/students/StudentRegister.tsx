import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { FormField } from "@components/FormField";
import { Breadcrumb } from "@components/Breadcrumb";
import { useToast } from "@contexts/ToastContext";
import { StudentService } from "@services/StudentService";
import { AcademicYearService } from "@services/AcademicYearService";
import { TermService } from "@services/TermService";
import { LevelService } from "@services/LevelService";
import { ClassService } from "@services/ClassService";
import { createStudentSchema, type StudentFormValues } from "@validation/studentSchema";
import { LEVEL_CATEGORIES, categorizeLevelCode, type LevelCategoryKey } from "@config/appConfig";
import type { SchoolClass } from "@models/SchoolClass";
import type { Level } from "@models/Level";

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY: StudentFormValues = {
  admissionNumber: "",
  emisNumber: "",
  ghanaCardNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  gender: "M",
  dateOfBirth: "",
  nationality: "Ghanaian",
  specialEducationalNeeds: "",
  academicYearOfAdmissionId: 0,
  admissionDate: todayIso(),
  previousSchool: "",
  boardingStatus: "Day",
  termId: 0,
  levelId: 0,
  classId: 0,
  guardianFullName: "",
  guardianRelationship: "",
  guardianPhone: "",
  guardianAlternativePhone: "",
  guardianEmail: "",
  guardianOccupation: "",
  guardianResidentialAddress: "",
  guardianDigitalAddress: "",
  guardianEmergencyContactName: "",
  guardianEmergencyContactPhone: "",
  status: "ACTIVE",
};

/** Module 1 - Student Registration. Creates the Student identity row,
 *  the primary Guardian row, and the initial Enrollment row together
 *  (StudentService.register runs all three in one transaction). */
export function StudentRegister() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const students = useLiveQuery(() => StudentService.getAll(), []);
  const academicYears = useLiveQuery(() => AcademicYearService.getAll(), []);
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);

  const schema = createStudentSchema(students ?? []);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Step 1 of placement is a broad, familiar stage (KG / Primary / JHS) -
  // not a database concept, just a grouping over whatever Levels the
  // school has defined - which step 2 (Class) then narrows down to that
  // stage's specific grades. See categorizeLevelCode in @config/appConfig
  // for why this doesn't require any change to the Level/Class data model.
  const [levelCategory, setLevelCategory] = useState<LevelCategoryKey | "">("");

  const classesWithLevel = useMemo(() => {
    const levelById = new Map((levels ?? []).map((l) => [l.id, l]));
    const rows: Array<{ cls: SchoolClass; level: Level }> = [];
    for (const c of classes ?? []) {
      if (!c.isActive) continue;
      const level = c.levelId ? levelById.get(c.levelId) : undefined;
      if (level) rows.push({ cls: c, level });
    }
    return rows;
  }, [classes, levels]);

  const availableCategories = useMemo(
    () => LEVEL_CATEGORIES.filter((cat) => classesWithLevel.some((x) => categorizeLevelCode(x.level.code) === cat.key)),
    [classesWithLevel],
  );

  const classOptionsForCategory = useMemo(
    () =>
      classesWithLevel
        .filter((x) => categorizeLevelCode(x.level.code) === levelCategory)
        .sort((a, b) => a.level.sortOrder - b.level.sortOrder),
    [classesWithLevel, levelCategory],
  );

  const selectedClassId = watch("classId");

  const onSubmit = async (values: StudentFormValues) => {
    try {
      const id = await StudentService.register(values);
      showToast("Student registered successfully.", "success");
      navigate(`/students/${id}`);
    } catch (err) {
      console.error(err);
      showToast("Could not register the student. Please check the form and try again.", "error");
    }
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Students", path: "/students" }, { label: "Register" }]} />
      <PageHeader title="Register Student" description="A permanent Student ID is generated automatically on save." />

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
              <FormField label="Preferred name" error={errors.preferredName?.message}>
                <input className="form-control" {...register("preferredName")} />
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
              <FormField label="EMIS number (optional)" error={errors.emisNumber?.message}>
                <input className="form-control" {...register("emisNumber")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Ghana Card number (optional)" error={errors.ghanaCardNumber?.message}>
                <input className="form-control" {...register("ghanaCardNumber")} />
              </FormField>
            </div>
            <div className="col-12">
              <FormField label="Special educational needs / disability (optional)" error={errors.specialEducationalNeeds?.message}>
                <input className="form-control" {...register("specialEducationalNeeds")} />
              </FormField>
            </div>
          </div>
        </Card>

        <Card className="mb-4">
          <h2 className="h6 mb-3">Academic information</h2>
          <div className="row">
            <div className="col-md-4">
              <FormField label="Academic year of admission" required error={errors.academicYearOfAdmissionId?.message}>
                <select className="form-select" {...register("academicYearOfAdmissionId", { valueAsNumber: true })}>
                  <option value={0}>Select…</option>
                  {academicYears?.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Admission date (optional)" error={errors.admissionDate?.message}>
                <input type="date" className="form-control" {...register("admissionDate")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Boarding/Day (optional)" error={errors.boardingStatus?.message}>
                <select className="form-select" {...register("boardingStatus")}>
                  <option value="Day">Day</option>
                  <option value="Boarding">Boarding</option>
                </select>
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Current term" required error={errors.termId?.message}>
                <select className="form-select" {...register("termId", { valueAsNumber: true })}>
                  <option value={0}>Select…</option>
                  {terms?.map((t) => <option key={t.id} value={t.id}>{t.termName}{t.isActive ? " (active)" : ""}</option>)}
                </select>
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Level" required hint="KG, Primary or JHS - narrows the Class list below.">
                <select
                  className="form-select"
                  value={levelCategory}
                  onChange={(e) => {
                    const next = e.target.value as LevelCategoryKey | "";
                    setLevelCategory(next);
                    setValue("classId", 0, { shouldValidate: true });
                    setValue("levelId", 0, { shouldValidate: true });
                  }}
                >
                  <option value="">Select…</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Class" required error={errors.classId?.message || errors.levelId?.message}>
                <input type="hidden" {...register("levelId", { valueAsNumber: true })} />
                <select
                  className="form-select"
                  disabled={!levelCategory}
                  value={selectedClassId || 0}
                  {...register("classId", {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const classId = Number(e.target.value);
                      const match = classOptionsForCategory.find((x) => x.cls.id === classId);
                      setValue("levelId", match ? (match.level.id as number) : 0, { shouldValidate: true });
                    },
                  })}
                >
                  <option value={0}>{levelCategory ? "Select…" : "Select a level first"}</option>
                  {classOptionsForCategory.map(({ cls }) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Previous school (optional)" error={errors.previousSchool?.message}>
                <input className="form-control" {...register("previousSchool")} />
              </FormField>
            </div>
            <div className="col-md-6">
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
            <div className="col-md-4">
              <FormField label="Parent/guardian name" required error={errors.guardianFullName?.message}>
                <input className="form-control" {...register("guardianFullName")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Relationship" required error={errors.guardianRelationship?.message}>
                <input className="form-control" placeholder="Mother, Father, Guardian…" {...register("guardianRelationship")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Occupation (optional)" error={errors.guardianOccupation?.message}>
                <input className="form-control" {...register("guardianOccupation")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Phone number" required error={errors.guardianPhone?.message}>
                <input className="form-control" {...register("guardianPhone")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Alternative phone" error={errors.guardianAlternativePhone?.message}>
                <input className="form-control" {...register("guardianAlternativePhone")} />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Email" error={errors.guardianEmail?.message}>
                <input type="email" className="form-control" {...register("guardianEmail")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Residential address" error={errors.guardianResidentialAddress?.message}>
                <input className="form-control" {...register("guardianResidentialAddress")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Digital address (GPS)" error={errors.guardianDigitalAddress?.message}>
                <input className="form-control" {...register("guardianDigitalAddress")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Emergency contact name" error={errors.guardianEmergencyContactName?.message}>
                <input className="form-control" {...register("guardianEmergencyContactName")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Emergency contact phone" error={errors.guardianEmergencyContactPhone?.message}>
                <input className="form-control" {...register("guardianEmergencyContactPhone")} />
              </FormField>
            </div>
          </div>
        </Card>

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/students")}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Registering…" : "Register student"}
          </button>
        </div>
      </form>
    </>
  );
}

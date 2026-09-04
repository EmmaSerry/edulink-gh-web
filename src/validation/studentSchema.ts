import { z } from "zod";
import { requiredString, optionalString, phoneNumber, emailAddress, isDuplicate } from "./common";
import type { Student } from "@models/Student";

const NOT_FUTURE = (dateStr: string) => new Date(dateStr) <= new Date();

export function createStudentSchema(existing: Student[], excludeId?: number) {
  return z
    .object({
      // Personal information
      admissionNumber: optionalString,
      emisNumber: optionalString,
      ghanaCardNumber: optionalString,
      firstName: requiredString("First name"),
      middleName: optionalString,
      lastName: requiredString("Last name"),
      preferredName: optionalString,
      gender: z.enum(["M", "F"], { required_error: "Gender is required" }),
      dateOfBirth: requiredString("Date of birth"),
      nationality: requiredString("Nationality"),
      specialEducationalNeeds: optionalString,

      // Academic information (admission event)
      academicYearOfAdmissionId: z.number({ invalid_type_error: "Academic year of admission is required" }),
      admissionDate: optionalString,
      previousSchool: optionalString,
      boardingStatus: z.enum(["Day", "Boarding"]).optional(),

      // Initial placement (used to create the first Enrollment record)
      termId: z.number({ invalid_type_error: "Current term is required" }),
      levelId: z.number({ invalid_type_error: "Level is required" }),
      classId: z.number({ invalid_type_error: "Class is required" }),

      // Parent / guardian
      guardianFullName: requiredString("Parent/guardian name"),
      guardianRelationship: requiredString("Relationship"),
      guardianPhone: requiredString("Parent/guardian phone number").regex(
        /^[0-9+()\-\s]{7,20}$/,
        "Enter a valid phone number",
      ),
      guardianAlternativePhone: phoneNumber,
      guardianEmail: emailAddress,
      guardianOccupation: optionalString,
      guardianResidentialAddress: optionalString,
      guardianDigitalAddress: optionalString,
      guardianEmergencyContactName: optionalString,
      guardianEmergencyContactPhone: phoneNumber,

      status: z.enum(["ACTIVE", "TRANSFERRED_OUT", "GRADUATED", "WITHDRAWN", "DECEASED"]),
    })
    .refine((data) => NOT_FUTURE(data.dateOfBirth), {
      message: "Date of birth cannot be in the future",
      path: ["dateOfBirth"],
    })
    .refine((data) => !data.admissionDate || new Date(data.admissionDate) >= new Date(data.dateOfBirth), {
      message: "Admission date cannot be before the date of birth",
      path: ["admissionDate"],
    })
    .refine(
      (data) =>
        !data.admissionNumber ||
        !isDuplicate(existing, data.admissionNumber, (s) => s.admissionNumber ?? "", excludeId, (s) => s.id),
      { message: "This admission number is already in use", path: ["admissionNumber"] },
    )
    .refine(
      (data) =>
        !data.emisNumber ||
        !isDuplicate(existing, data.emisNumber, (s) => s.emisNumber ?? "", excludeId, (s) => s.id),
      { message: "This EMIS number is already in use", path: ["emisNumber"] },
    )
    .refine(
      (data) =>
        !existing.some(
          (s) =>
            s.id !== excludeId &&
            s.firstName.trim().toLowerCase() === data.firstName.trim().toLowerCase() &&
            s.lastName.trim().toLowerCase() === data.lastName.trim().toLowerCase() &&
            s.dateOfBirth === data.dateOfBirth,
        ),
      {
        message: "A student with this name and date of birth already exists - check this isn't a duplicate registration",
        path: ["lastName"],
      },
    );
}

export type StudentFormValues = z.infer<ReturnType<typeof createStudentSchema>>;

/** Used when editing an already-registered student - the permanent
 *  identity + guardian fields only. Placement (term/level/class) is
 *  edited separately via Class (Re)assignment (EnrollmentService), not
 *  through this form, since Student no longer stores placement data. */
export function createStudentEditSchema(existing: Student[], excludeId?: number) {
  return z
    .object({
      admissionNumber: optionalString,
      emisNumber: optionalString,
      ghanaCardNumber: optionalString,
      firstName: requiredString("First name"),
      middleName: optionalString,
      lastName: requiredString("Last name"),
      preferredName: optionalString,
      gender: z.enum(["M", "F"], { required_error: "Gender is required" }),
      dateOfBirth: requiredString("Date of birth"),
      nationality: requiredString("Nationality"),
      specialEducationalNeeds: optionalString,
      academicYearOfAdmissionId: z.number({ invalid_type_error: "Academic year of admission is required" }),
      admissionDate: optionalString,
      previousSchool: optionalString,
      boardingStatus: z.enum(["Day", "Boarding"]).optional(),
      guardianFullName: requiredString("Parent/guardian name"),
      guardianRelationship: requiredString("Relationship"),
      guardianPhone: requiredString("Parent/guardian phone number").regex(
        /^[0-9+()\-\s]{7,20}$/,
        "Enter a valid phone number",
      ),
      guardianAlternativePhone: phoneNumber,
      guardianEmail: emailAddress,
      guardianOccupation: optionalString,
      guardianResidentialAddress: optionalString,
      guardianDigitalAddress: optionalString,
      guardianEmergencyContactName: optionalString,
      guardianEmergencyContactPhone: phoneNumber,
      status: z.enum(["ACTIVE", "TRANSFERRED_OUT", "GRADUATED", "WITHDRAWN", "DECEASED"]),
    })
    .refine((data) => NOT_FUTURE(data.dateOfBirth), {
      message: "Date of birth cannot be in the future",
      path: ["dateOfBirth"],
    })
    .refine((data) => !data.admissionDate || new Date(data.admissionDate) >= new Date(data.dateOfBirth), {
      message: "Admission date cannot be before the date of birth",
      path: ["admissionDate"],
    })
    .refine(
      (data) =>
        !data.admissionNumber ||
        !isDuplicate(existing, data.admissionNumber, (s) => s.admissionNumber ?? "", excludeId, (s) => s.id),
      { message: "This admission number is already in use", path: ["admissionNumber"] },
    )
    .refine(
      (data) =>
        !data.emisNumber ||
        !isDuplicate(existing, data.emisNumber, (s) => s.emisNumber ?? "", excludeId, (s) => s.id),
      { message: "This EMIS number is already in use", path: ["emisNumber"] },
    );
}

export type StudentEditFormValues = z.infer<ReturnType<typeof createStudentEditSchema>>;

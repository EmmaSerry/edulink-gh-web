import { z } from "zod";
import { requiredString, optionalString, phoneNumber, emailAddress } from "./common";

export const schoolSchema = z.object({
  name: requiredString("School name"),
  schoolCode: requiredString("School code"),
  circuit: requiredString("Circuit"),
  district: requiredString("District"),
  region: requiredString("Region"),
  postalAddress: optionalString,
  digitalAddress: optionalString,
  physicalAddress: optionalString,
  telephone: phoneNumber,
  alternativeTelephone: phoneNumber,
  email: emailAddress,
  website: optionalString,
  headTeacherName: optionalString,
  headTeacherPhone: phoneNumber,
  assistantHeadTeacherName: optionalString,
  assistantHeadTeacherPhone: phoneNumber,
  motto: optionalString,
  vision: optionalString,
  mission: optionalString,
  reportHeader: optionalString,
  reportFooter: optionalString,
  officialSignatoryTitles: optionalString,
});

export type SchoolFormValues = z.infer<typeof schoolSchema>;

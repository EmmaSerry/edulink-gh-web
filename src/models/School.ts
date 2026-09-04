export interface School {
  id?: number;
  // School Information
  name: string;
  schoolCode: string;
  circuit: string;
  district: string;
  region: string;
  postalAddress?: string;
  digitalAddress?: string; // GPS
  physicalAddress?: string;
  telephone?: string;
  alternativeTelephone?: string;
  email?: string;
  website?: string;
  // Administrative Information
  headTeacherName?: string;
  headTeacherPhone?: string;
  assistantHeadTeacherName?: string;
  assistantHeadTeacherPhone?: string;
  // Branding
  logoDataUrl?: string;
  motto?: string;
  vision?: string;
  mission?: string;
  // Report Information
  reportHeader?: string;
  reportFooter?: string;
  officialSignatoryTitles?: string;
  reportWatermarkDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

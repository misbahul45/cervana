export interface ApplicationForm {
  fullName: string;
  bio: string;
  expertise: string;
  portfolioUrl: string;
  cvUrl: string;
}

const WEB_URL = /^https?:\/\/[^\s]+$/i;

export function applicationProblem(form: ApplicationForm): string | null {
  if (form.fullName.trim().length < 2) return 'Nama lengkap wajib diisi.';
  if (form.fullName.trim().length > 200) return 'Nama lengkap terlalu panjang.';
  if (form.bio.length > 5000) return 'Bio maksimal 5000 karakter.';
  if (form.expertise.length > 1000) return 'Bidang keahlian maksimal 1000 karakter.';
  if (form.portfolioUrl.trim() && !WEB_URL.test(form.portfolioUrl.trim())) return 'Tautan portofolio harus diawali http:// atau https://.';
  if (form.cvUrl.trim() && !WEB_URL.test(form.cvUrl.trim())) return 'Tautan CV harus diawali http:// atau https://.';
  return null;
}

export function applicationPayload(form: ApplicationForm) {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    fullName: form.fullName.trim(),
    ...(optional(form.bio) ? { bio: optional(form.bio) } : {}),
    ...(optional(form.expertise) ? { expertise: optional(form.expertise) } : {}),
    ...(optional(form.portfolioUrl) ? { portfolioUrl: optional(form.portfolioUrl) } : {}),
    ...(optional(form.cvUrl) ? { cvUrl: optional(form.cvUrl) } : {}),
  };
}

export type ApplicationStage = 'none' | 'pending' | 'approved' | 'rejected';

export function applicationStage(application: { status: string } | null | undefined): ApplicationStage {
  if (!application) return 'none';
  if (application.status === 'APPROVED') return 'approved';
  if (application.status === 'REJECTED') return 'rejected';
  return 'pending';
}

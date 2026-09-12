import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

export const credentialUrlSchema = z.object({
  url: z.string().url(),
  fileId: z.string().optional(),
});

export const baseCertificationSchema = z.object({
  teacherApplicationId: z.string().uuid(),
  name: z.string().min(1, "Certification name is required"),
  issuer: z.string().optional(),
  issuedDate: z.date().optional(),
  expirationDate: z.date().optional(),
  credentialUrl: credentialUrlSchema.optional(),
  credentialId: z.string().optional(),
});

export const CreateCertificationDto = extendApi(
  z.union([baseCertificationSchema, z.array(baseCertificationSchema)]),
  {
    title: "CreateCertificationDto",
    example: [
      {
        teacherApplicationId: "uuid-app-2222",
        name: "AWS Certified Solutions Architect – Associate",
        issuer: "Amazon Web Services",
        issuedDate: "2022-05-10T00:00:00.000Z",
        expirationDate: "2025-05-10T00:00:00.000Z",
        credentialUrl: {
          url: "https://aws.amazon.com/verification/cert/EXAMPLE123",
          fileId: "file-xyz-123",
        },
        credentialId: "EXAMPLE123",
      },
    ],
  }
);

export type CreateCertificationType = z.infer<typeof CreateCertificationDto>;

export const UpdateCertificationDto = extendApi(
  baseCertificationSchema.partial(),
  {
    title: "UpdateCertificationDto",
    example: {
      name: "AWS Certified Solutions Architect – Professional",
      credentialUrl: {
        url: "https://aws.amazon.com/verification/cert/NEW456",
      },
    },
  }
);

export type UpdateCertificationType = z.infer<typeof UpdateCertificationDto>;

import z from "zod";

export const LearningStyleSchema=z.object({
  userTopicId: z.string(),
  visual: z.number().min(1),
  auditory: z.number().min(1),
  reading: z.number().min(1),
  kinesthetic: z.number().min(1),
  dominantStyle: z.string().min(1, {
    message: 'tolong jelaskan apa yang menjadi gaya belajar dominan dalam kamu'
  }),
  takenAt: z.date(),
})

export type LearningStyleSchemaType=z.infer<typeof LearningStyleSchema>
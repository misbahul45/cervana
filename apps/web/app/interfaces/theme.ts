export interface Theme {
  id: string
  title: string
  description?: string | null
  primary: string
  secondary: string
  tertiary?: string | null
  quaternary?: string | null
  bg_image?: { url: string; fileId: string } | null
  planet_image?: { url: string; fileId: string } | null
  createdAt: Date | string
  updatedAt: Date | string
}

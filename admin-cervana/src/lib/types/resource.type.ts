export enum ResourceType {
  VIDEO = "VIDEO",
  TEXT = "TEXT",
  PDF = "PDF",
  LINK = "LINK",
  IMAGE = "IMAGE",
  INTERACTIVE = "INTERACTIVE"
}

export interface Resource {
  id: string;
  type: ResourceType;
  title?: string;
  content?: string;
  fileName?: any;
}

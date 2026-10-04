export interface StationRef {
  id: string;
  title: string;
  topicId: string | null;
  level: number;
}

export interface PanelBook {
  id: string;
  title: string;
  titleEs?: string;
  authors: string[];
  year?: number;
  kind: string;
  level: number;
  topics: string[];
  summary?: string;
  context?: string;
  sources: { url: string; title?: string; timestamp?: string; quote?: string }[];
  confidence: "low" | "ok";
  missing: string[];
  coverId?: number;
}

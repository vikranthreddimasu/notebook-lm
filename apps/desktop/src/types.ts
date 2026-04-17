export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  prompt: string;
  history?: ChatMessage[];
  notebook_id?: string | null;
  notebook_ids?: string[] | null;
  conversation_id?: string | null;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  metrics?: Record<string, number>;
}

export interface StreamSource {
  source_path: string;
  preview: string;
  distance?: number | null;
  relevance_score?: number;
  notebook_id?: string;
}

export type ChatStreamEvent =
  | {
      type: 'meta';
      provider: string;
      sources: StreamSource[];
      metrics?: Record<string, number>;
      conversation_id?: string;
    }
  | { type: 'token'; delta: string }
  | { type: 'done'; reply: string; metrics?: Record<string, number> }
  | { type: 'error'; message: string }
  | { type: 'warning'; message: string };

export interface MetricsSummary {
  conversations: number;
  avg_total_ms?: number | null;
  avg_llm_ms?: number | null;
  avg_retrieval_ms?: number | null;
  provider_breakdown: Record<string, number>;
}

export interface AgentPlanResponse {
  plan: string;
}

export interface BackendConfig {
  llm_provider: string;
  ollama_model: string;
  resolved_ollama_model?: string;
  model_selection_reason?: string;
  ollama_base_url: string;
  use_langchain_splitter?: boolean;
  use_llamaindex_rag?: boolean;
  embedding_model?: string;
  enable_speech_stt?: boolean;
  enable_speech_tts?: boolean;
}

export interface IngestionResponse {
  notebook_id: string;
  documents_processed: number;
  chunks_indexed: number;
}

export interface DocumentInfo {
  filename: string;
  source_path: string;
  chunk_count: number;
  preview: string;
}

export interface DocumentsListResponse {
  documents: DocumentInfo[];
}

export interface Notebook {
  notebook_id: string;
  title: string;
  description?: string;
  source_count: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface SourceChunk {
  source_path: string;
  preview: string;
  distance?: number | null;
  document_name: string;
  relevance_score?: number;
  notebook_id?: string;
}

export interface CreateNotebookRequest {
  title?: string;
}

export interface Conversation {
  id: string;
  notebook_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersistedMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceChunk[] | null;
  created_at: string;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  cached_embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface ConceptEdge {
  id: string;
  source_id: string;
  target_id: string;
  created_at: string;
}

export interface CreateConceptInput {
  name: string;
  description: string;
}

export interface UpdateConceptInput {
  name?: string;
  description?: string;
}

export interface CreateEdgeInput {
  source_id: string;
  target_id: string;
}

export interface ConceptGraphData {
  concepts: Concept[];
  edges: ConceptEdge[];
}

// Auto-generated concept graph

export interface GeneratedConcept {
  name: string;
  description: string;
  status: "new" | "existing";
  existing_id?: string;
  source_chunk_ids?: string[];
}

export interface GeneratedEdge {
  source_name: string;
  target_name: string;
}

export interface GeneratedGraphPreview {
  concepts: GeneratedConcept[];
  edges: GeneratedEdge[];
}

// Phase 3: Course Materials

export interface CourseMaterial {
  id: string;
  title: string;
  file_name: string;
  file_type: "pdf" | "text" | "markdown";
  file_path: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface CourseMaterialChunk {
  id: string;
  material_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding: number[] | null;
  created_at: string;
}

export interface MatchedChunk {
  id: string;
  material_id: string;
  chunk_text: string;
  chunk_index: number;
  page_number: number | null;
  similarity: number;
}

// Phase 4: Questions, Responses, Readiness

export type QuestionType = "multiple_choice" | "free_response";
export type Difficulty = "easy" | "medium" | "hard";

export interface MCOption {
  label: string;
  text: string;
}

export interface Question {
  id: string;
  concept_id: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  question_text: string;
  options: MCOption[] | null;
  correct_answer: string;
  explanation: string;
  source_context: string | null;
  generated_by: string | null;
  curated: boolean;
  created_at: string;
}

export interface StudentResponse {
  id: string;
  student_id: string;
  question_id: string;
  concept_id: string;
  answer_text: string;
  is_correct: boolean;
  ai_feedback: string;
  self_assessment: number | null;
  created_at: string;
}

export interface ReadinessScore {
  id: string;
  student_id: string;
  concept_id: string;
  raw_score: number;
  quiz_ewma: number;
  self_assessment_avg: number;
  response_count: number;
  updated_at: string;
}

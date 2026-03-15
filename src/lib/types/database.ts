export interface Concept {
  id: string;
  name: string;
  description: string;
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

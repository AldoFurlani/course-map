-- Add favorited column to student_responses so students can bookmark
-- questions they want to revisit from their history.
ALTER TABLE student_responses
  ADD COLUMN favorited boolean NOT NULL DEFAULT false;

-- Index for filtering favorited responses per student per course
CREATE INDEX idx_student_responses_favorited
  ON student_responses (student_id, course_id)
  WHERE favorited = true;

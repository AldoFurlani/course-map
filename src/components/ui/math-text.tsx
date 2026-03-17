"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders text that may contain LaTeX math delimiters or bare math notation.
 * - `$$...$$` → display math (centered block)
 * - `$...$`  → inline math
 * - Bare patterns like `x_t`, `g_{t,j}`, `ℝ^d` → auto-wrapped as inline math
 */
export default function MathText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => renderMathInText(text), [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), { displayMode, throwOnError: false });
  } catch {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}

// Unicode math symbols → LaTeX command mappings
const UNICODE_MAP: Record<string, string> = {
  "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta",
  "ε": "\\varepsilon", "ζ": "\\zeta", "η": "\\eta", "θ": "\\theta",
  "λ": "\\lambda", "μ": "\\mu", "ν": "\\nu", "ξ": "\\xi",
  "π": "\\pi", "ρ": "\\rho", "σ": "\\sigma", "τ": "\\tau",
  "φ": "\\varphi", "ψ": "\\psi", "ω": "\\omega",
  "Γ": "\\Gamma", "Δ": "\\Delta", "Θ": "\\Theta", "Λ": "\\Lambda",
  "Σ": "\\Sigma", "Φ": "\\Phi", "Ψ": "\\Psi", "Ω": "\\Omega",
  "∇": "\\nabla", "∂": "\\partial", "∞": "\\infty",
  "ℝ": "\\mathbb{R}", "ℤ": "\\mathbb{Z}", "ℕ": "\\mathbb{N}",
  "ℚ": "\\mathbb{Q}", "ℂ": "\\mathbb{C}",
  "≤": "\\leq", "≥": "\\geq", "≠": "\\neq", "≈": "\\approx",
  "∈": "\\in", "∉": "\\notin", "⊂": "\\subset", "⊃": "\\supset",
  "∪": "\\cup", "∩": "\\cap", "×": "\\times", "·": "\\cdot",
  "→": "\\to", "←": "\\leftarrow", "⟶": "\\longrightarrow",
  "⟵": "\\longleftarrow",
};

const UNICODE_CHARS = Object.keys(UNICODE_MAP).join("");
const UNICODE_RE = new RegExp(`[${UNICODE_CHARS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}]`, "g");

/**
 * Convert Unicode math characters inside a LaTeX string to their commands.
 */
function unicodeToLatex(tex: string): string {
  return tex.replace(UNICODE_RE, (ch) => UNICODE_MAP[ch] ?? ch);
}

/**
 * Detect whether the text has any explicit $...$ delimiters.
 */
function hasExplicitDelimiters(text: string): boolean {
  return /\$/.test(text);
}

/**
 * For legacy questions without $ delimiters, detect bare math patterns
 * and wrap them. Patterns matched:
 *   - Greek/math Unicode followed by subscripts/superscripts: η_t, Σ_j, ℝ^d
 *   - Identifiers with subscripts/superscripts: w_t, g_{t,j}, x^2, f^*(x)
 *   - Short expressions with operators: (1 + Σ_j |g_{t,j}|)^{-1}
 */
function autoWrapBareMath(text: string): string {
  // Match sequences that look like math: start with a letter/Unicode-math char,
  // and contain subscripts, superscripts, or math operators
  // This regex matches "words" that contain _ or ^ or Unicode math chars
  const bareMathPattern = new RegExp(
    // A math-like token: letter/Unicode followed by subscripts/superscripts/braces
    `(?:[A-Za-z${UNICODE_CHARS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}])` +
    // Must contain at least one subscript, superscript, or be a lone Unicode math symbol
    `(?:[A-Za-z0-9_^{}|(),.+\\-*/=\\s${UNICODE_CHARS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}])*` +
    `(?:[_^][A-Za-z0-9{}()+\\-,.*]+)` +
    `(?:[A-Za-z0-9_^{}|(),.+\\-*/=\\s])*`,
    "g"
  );

  // Also match standalone Unicode math symbols (Greek letters, ∇, etc.) even without sub/superscripts
  const standaloneUnicode = new RegExp(
    `[${UNICODE_CHARS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}]` +
    `(?:[A-Za-z0-9_^{}()|,.+\\-*/=]*[_^][A-Za-z0-9{}()+\\-,.*]+[A-Za-z0-9_^{}()|,.+\\-*/=]*)?`,
    "g"
  );

  // Simple approach: find all tokens with subscripts/superscripts
  const result = text.replace(
    // Match: optional parens, a word char or unicode, then _/^ with content
    /(?:\([^)]*[_^{][^)]*\))|(?:[A-Za-zα-ωΑ-Ω∇∂ℝℤℕℚℂ][A-Za-z0-9]*(?:[_^](?:\{[^}]+\}|[A-Za-z0-9*]+))+(?:\([^)]*\))?)/g,
    (match) => {
      const latex = unicodeToLatex(match);
      return `$${latex}$`;
    }
  );

  // Wrap remaining standalone Unicode math symbols (single chars like η, Σ, ∇)
  return result.replace(
    new RegExp(`(?<![$A-Za-z])([${UNICODE_CHARS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}])(?![$A-Za-z])`, "g"),
    (_, ch) => `$${UNICODE_MAP[ch] ?? ch}$`
  );
}

function renderMathInText(text: string): string {
  let processed = text;

  // If no explicit $ delimiters, try to auto-detect bare math patterns
  if (!hasExplicitDelimiters(processed)) {
    processed = autoWrapBareMath(processed);
  }

  // Replace display math first ($$...$$)
  let result = processed.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (_, tex: string) => renderKatex(unicodeToLatex(tex), true)
  );

  // Then inline math ($...$)
  result = result.replace(
    /\$([^\$\n]+?)\$/g,
    (_, tex: string) => renderKatex(unicodeToLatex(tex), false)
  );

  // Basic markdown: bold and italic (after math so we don't mangle LaTeX)
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Convert newlines to <br> for multi-line questions
  result = result.replace(/\n/g, "<br>");

  return result;
}

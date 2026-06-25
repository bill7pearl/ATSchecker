/**
 * ATS Keyword Matching and Analysis Utility
 * Performs client-side comparative text analysis between a CV and a Job Description (JD).
 */

export interface SkillItem {
  name: string;
  category: "hard" | "soft" | "context";
  matched: boolean;
}

export interface StructuralFlag {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  fix: string;
}

export interface ATSAnalysisResult {
  matchPercentage: number;
  hardSkills: SkillItem[];
  softSkills: SkillItem[];
  contextKeywords: SkillItem[];
  structuralFlags: StructuralFlag[];
  statistics: {
    cvWordCount: number;
    jdWordCount: number;
    matchedCount: number;
    missingCount: number;
  };
}

// Stopwords array to clean text comparison
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant", "cannot", "could",
  "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during", "each", "few", "for", "from", "further",
  "had", "hadnt", "has", "hasnt", "have", "havent", "having", "he", "hed", "hell", "hes", "her", "here", "heres",
  "hers", "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in", "into", "is",
  "isnt", "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not", "of",
  "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
  "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such", "than", "that", "thats",
  "the", "their", "theirs", "them", "themselves", "then", "there", "theres", "these", "they", "theyd", "theyll",
  "theyre", "theyve", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasnt",
  "we", "wed", "well", "were", "weve", "werent", "what", "whats", "when", "whens", "where", "wheres", "which",
  "while", "who", "whos", "whom", "why", "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll",
  "youre", "youve", "your", "yours", "yourself", "yourselves"
]);

// Extensive list of common developer & professional skills
const HARD_SKILLS_DB = [
  "javascript", "typescript", "react", "next.js", "nextjs", "vue", "angular", "node.js", "nodejs", "express",
  "python", "django", "flask", "java", "spring", "c++", "c#", "dotnet", "go", "golang", "rust", "ruby", "rails",
  "php", "laravel", "sql", "postgresql", "mysql", "mongodb", "redis", "graphql", "rest api", "docker",
  "kubernetes", "aws", "azure", "gcp", "ci/cd", "git", "github", "tailwind css", "sass", "css", "html",
  "webpack", "esbuild", "vite", "unit testing", "jest", "cypress", "agile", "scrum", "typescript",
  "system architecture", "microservices", "serverless", "cloud computing", "machine learning",
  "ai", "data structure", "algorithms", "redux", "prisma", "orm", "nosql", "linux", "devops"
];

const SOFT_SKILLS_DB = [
  "communication", "teamwork", "leadership", "problem solving", "critical thinking", "time management",
  "adaptability", "collaboration", "creativity", "emotional intelligence", "conflict resolution",
  "mentorship", "active listening", "presentation", "negotiation", "work ethic", "decision making"
];

/**
 * Extracts and cleans words from a string.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\-\.]/g, " ") // keep words, spaces, hyphens, dots
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Escapes special characters for RegExp creation.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Core ATS Scoring logic.
 * Analyzes CV content against JD content.
 */
export function analyzeCV(cvText: string, jdText: string): ATSAnalysisResult {
  const cvTokens = tokenize(cvText);
  const jdTokens = tokenize(jdText);
  
  const cvWordSet = new Set(cvTokens);
  const jdWordSet = new Set(jdTokens);
  
  const cvRawLower = cvText.toLowerCase();
  const jdRawLower = jdText.toLowerCase();

  // 1. Identify skills from the Job Description
  const detectedHardSkills: SkillItem[] = [];
  const detectedSoftSkills: SkillItem[] = [];
  const detectedContextKeywords: SkillItem[] = [];

  // Match hard skills present in JD
  HARD_SKILLS_DB.forEach(skill => {
    const escaped = escapeRegExp(skill);
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])(${escaped})(?:$|[^a-zA-Z0-9])`, "i");
    if (regex.test(jdRawLower)) {
      const isMatched = regex.test(cvRawLower);
      detectedHardSkills.push({
        name: skill,
        category: "hard",
        matched: isMatched
      });
    }
  });

  // Match soft skills present in JD
  SOFT_SKILLS_DB.forEach(skill => {
    const escaped = escapeRegExp(skill);
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])(${escaped})(?:$|[^a-zA-Z0-9])`, "i");
    if (regex.test(jdRawLower)) {
      const isMatched = regex.test(cvRawLower);
      detectedSoftSkills.push({
        name: skill,
        category: "soft",
        matched: isMatched
      });
    }
  });

  // Extract other frequent words in JD (Context Keywords)
  const jdWordFreq: { [key: string]: number } = {};
  jdTokens.forEach(token => {
    // Exclude words that are already in hard/soft databases or too short
    if (
      token.length > 3 &&
      !HARD_SKILLS_DB.includes(token) &&
      !SOFT_SKILLS_DB.includes(token)
    ) {
      jdWordFreq[token] = (jdWordFreq[token] || 0) + 1;
    }
  });

  // Sort by frequency and take top 8 context keywords
  const topContextWords = Object.entries(jdWordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  topContextWords.forEach(word => {
    detectedContextKeywords.push({
      name: word,
      category: "context",
      matched: cvWordSet.has(word)
    });
  });

  // 2. Compute Match Percentage (Weighted math)
  // Weights: Hard Skills = 60%, Soft Skills = 20%, Context Keywords = 20%
  let hardWeight = 0, softWeight = 0, contextWeight = 0;
  let hardScore = 0, softScore = 0, contextScore = 0;

  if (detectedHardSkills.length > 0) {
    const matchedHard = detectedHardSkills.filter(s => s.matched).length;
    hardScore = (matchedHard / detectedHardSkills.length) * 100;
    hardWeight = 0.6;
  } else {
    // If no hard skills are specified in the JD, re-distribute weight to other segments
    hardWeight = 0;
  }

  if (detectedSoftSkills.length > 0) {
    const matchedSoft = detectedSoftSkills.filter(s => s.matched).length;
    softScore = (matchedSoft / detectedSoftSkills.length) * 100;
    softWeight = hardWeight === 0 ? 0.5 : 0.2;
  } else {
    softWeight = 0;
  }

  if (detectedContextKeywords.length > 0) {
    const matchedContext = detectedContextKeywords.filter(s => s.matched).length;
    contextScore = (matchedContext / detectedContextKeywords.length) * 100;
    contextWeight = 1 - (hardWeight + softWeight);
  } else {
    contextWeight = 0;
  }

  // Adjust weights if some sections are empty
  const totalWeight = hardWeight + softWeight + contextWeight;
  let rawMatchScore = 0;
  if (totalWeight > 0) {
    rawMatchScore = (
      (hardScore * hardWeight) +
      (softScore * softWeight) +
      (contextScore * contextWeight)
    ) / totalWeight;
  }

  // Bound between 0 and 100
  const matchPercentage = Math.round(Math.max(0, Math.min(100, rawMatchScore)));

  // 3. Structural Flags Audit
  const structuralFlags: StructuralFlag[] = [];

  // Check word count
  const wordCount = cvTokens.length;
  if (wordCount < 200) {
    structuralFlags.push({
      id: "flag-short",
      type: "error",
      message: "CV is extremely short (under 200 words).",
      fix: "Expand your descriptions to include details on impact, metrics, and key project methodologies."
    });
  } else if (wordCount > 1500) {
    structuralFlags.push({
      id: "flag-long",
      type: "warning",
      message: "CV exceeds standard length recommendations (over 1500 words).",
      fix: "Trim irrelevant roles or verbose phrasing. Aim to keep the CV under 2 pages (approx. 800 - 1000 words)."
    });
  }

  // Check contact info
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cvText);
  const hasPhone = /(\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(cvText);
  if (!hasEmail) {
    structuralFlags.push({
      id: "flag-email",
      type: "error",
      message: "No email address detected.",
      fix: "Add a clear email address in a standard header position so recruitment platforms can contact you."
    });
  }
  if (!hasPhone) {
    structuralFlags.push({
      id: "flag-phone",
      type: "warning",
      message: "No phone number detected.",
      fix: "Add a phone number to ensure hiring teams have a secondary contact method."
    });
  }

  // Check section titles
  const experienceKeywords = ["experience", "employment", "history", "work", "career"];
  const skillsKeywords = ["skills", "technologies", "expertise", "competencies"];
  const educationKeywords = ["education", "academic", "degree", "university"];

  const hasExperienceSection = experienceKeywords.some(kw => cvRawLower.includes(kw));
  const hasSkillsSection = skillsKeywords.some(kw => cvRawLower.includes(kw));
  const hasEducationSection = educationKeywords.some(kw => cvRawLower.includes(kw));

  if (!hasExperienceSection) {
    structuralFlags.push({
      id: "flag-experience",
      type: "error",
      message: "Standard 'Professional Experience' section header not recognized.",
      fix: "Include a section clearly labeled 'Experience' or 'Professional Experience' to aid ATS grouping."
    });
  }
  if (!hasSkillsSection) {
    structuralFlags.push({
      id: "flag-skills",
      type: "warning",
      message: "No explicit 'Skills' section header detected.",
      fix: "Add a separate 'Skills' or 'Technical Skills' section list to optimize keyword parsing."
    });
  }
  if (!hasEducationSection) {
    structuralFlags.push({
      id: "flag-education",
      type: "error",
      message: "No standard 'Education' section header recognized.",
      fix: "Add a clear 'Education' section detailing degrees and certificates."
    });
  }

  // Check layout flags (like standard PDF elements that ATS struggle with)
  if (cvRawLower.includes("table") || cvRawLower.includes("column")) {
    // General check if they write words related to layout or if they have special blocks
    // Note: Since raw text parser can't identify shapes, we warn them about standard parsing rules
    structuralFlags.push({
      id: "flag-layout-warn",
      type: "info",
      message: "Ensure your layout avoids multi-column grids or custom graphics.",
      fix: "ATS systems parse resumes from top-to-bottom, left-to-right. Multi-column structures can cause overlapping word extraction."
    });
  }

  // Compute matched/missing stats
  const allSkills = [...detectedHardSkills, ...detectedSoftSkills, ...detectedContextKeywords];
  const matchedCount = allSkills.filter(s => s.matched).length;
  const missingCount = allSkills.length - matchedCount;

  return {
    matchPercentage,
    hardSkills: detectedHardSkills,
    softSkills: detectedSoftSkills,
    contextKeywords: detectedContextKeywords,
    structuralFlags,
    statistics: {
      cvWordCount: cvText.split(/\s+/).filter(Boolean).length,
      jdWordCount: jdText.split(/\s+/).filter(Boolean).length,
      matchedCount,
      missingCount
    }
  };
}

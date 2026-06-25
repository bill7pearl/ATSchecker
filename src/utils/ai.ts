import { ResumeData, DEFAULT_RESUME_DATA } from "./resumeTypes";

const KEY_STORAGE_KEY = "ats_cv_gemini_api_key";
const MODEL_STORAGE_KEY = "ats_cv_gemini_model";

export interface AISettings {
  apiKey: string;
  model: string;
}

/**
 * Gets local API settings.
 */
export function getAISettings(): AISettings {
  if (typeof window === "undefined") return { apiKey: "", model: "gemini-1.5-flash" };
  return {
    apiKey: localStorage.getItem(KEY_STORAGE_KEY) || "",
    model: localStorage.getItem(MODEL_STORAGE_KEY) || "gemini-1.5-flash",
  };
}

/**
 * Saves local API settings.
 */
export function saveAISettings(settings: AISettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_STORAGE_KEY, settings.apiKey.trim());
  localStorage.setItem(MODEL_STORAGE_KEY, settings.model);
}

/**
 * Standard fetch wrapper for Gemini API content generation.
 * Performs a direct POST request to Gemini endpoints.
 */
async function callGemini(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Please configure it in Settings.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2, // low temp for accurate cv edits
      maxOutputTokens: 8192
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || response.statusText;
    throw new Error(`Gemini API Error: ${message} (Status: ${response.status})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Invalid or empty response format from Gemini API.");
  }

  return text;
}

/**
 * Optimizes a CV to naturally inject missing skills/keywords based on a Job Description.
 * Returns structured ResumeData for template rendering.
 */
export async function generateOptimizedCV(
  cvText: string,
  jdText: string,
  missingSkills: string[]
): Promise<ResumeData> {
  const { apiKey, model } = getAISettings();
  const skillsList = missingSkills.join(", ");

  const prompt = `
You are an expert ATS Optimization Assistant and Professional Resume Writer. 
Your goal is to parse and optimize the following CV text to naturally incorporate the missing keywords listed below without "keyword stuffing" or fabricating experience.

You MUST format your output as a single, valid JSON object matching the JSON schema below. 

---
TARGET JOB DESCRIPTION:
${jdText}

---
ORIGINAL CV:
${cvText}

---
MISSING KEYWORDS/SKILLS TO INCORPORATE:
${skillsList}

---
JSON SCHEMA FOR OUTPUT:
{
  "name": "Candidate's Full Name (Extract from CV)",
  "title": "Optimized Professional Title (e.g. Senior Software Engineer - tailored to the job description)",
  "summary": "Professional summary optimized to contain critical keywords and matching job context. Skip this field if the original CV has no summary section and you do not want to add one.",
  "contact": {
    "email": "Email address",
    "phone": "Phone number",
    "location": "City, State or Location",
    "linkedin": "LinkedIn profile link or other professional link"
  },
  "experience": [
    {
      "role": "Job Role (e.g. Frontend Engineer)",
      "company": "Company Name",
      "period": "Employment dates (e.g. 2021 - Present)",
      "highlights": [
        "Bullet point 1 optimized to naturally inject missing keywords.",
        "Bullet point 2 optimized to naturally inject missing keywords."
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "school": "University or School Name",
      "period": "Graduation dates"
    }
  ],
  "skills": {
    "hard": ["List of hard skills from CV + missing keywords that candidate has details for"],
    "soft": ["List of soft skills matching the JD requirements"]
  }
}

---
CRITICAL CONSTRAINTS & RULES:
1. Return ONLY the JSON object. Do not include any explanations, greetings, introduction, or conversational text.
2. If the candidate's original CV does not have a summary or you wish to keep the resume to exactly one page, you can set the "summary" string to an empty string "".
3. Ensure all JSON strings are properly escaped and the output constitutes valid JSON.
4. STRICTLY FORBIDDEN FROM FABRICATING/HALLUCINATING: Do NOT invent or add any new job roles, companies, projects, locations, dates, certifications, degrees, or schools that are not explicitly present in the candidate's ORIGINAL CV.
5. 1-TO-1 MAPPING: Every item in the "experience" and "education" lists in the output MUST map 1-to-1 with the original jobs, companies, dates, and schools in the ORIGINAL CV. You must NOT add new jobs or schools, nor delete existing ones.
6. NATURAL REWRITING: Your optimization is strictly limited to naturally rewriting the existing highlights/bullet points of each job in the CV to incorporate the missing keywords from the Job Description (where relevant and contextually plausible based on the candidate's existing experience).
7. CONTACT DETAILS: The candidate's name, email, phone, location, and linkedin MUST be taken directly from the ORIGINAL CV. Do NOT use mock data (such as "John Doe", "Company Name", "University or School Name"). If a contact detail is not present in the original CV, set it to an empty string "" instead of inventing it.
`;

  const responseText = await callGemini(prompt, apiKey, model);
  
  try {
    let cleaned = responseText.trim();
    // Match and extract standard ```json {...} ``` or ``` {...} ``` block
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    // Extract from first { to last } for safety
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned) as ResumeData;

    // Perform validation on critical arrays to avoid map errors
    if (!parsed.experience) parsed.experience = [];
    if (!parsed.education) parsed.education = [];
    if (!parsed.skills) parsed.skills = { hard: [], soft: [] };
    if (!parsed.skills.hard) parsed.skills.hard = [];
    if (!parsed.skills.soft) parsed.skills.soft = [];
    if (!parsed.contact) parsed.contact = { email: "", phone: "", location: "", linkedin: "" };

    return parsed;
  } catch (error) {
    console.error("Failed to parse responseText as valid ResumeData JSON", error);
    
    // Safe fallback structure
    const fallback: ResumeData = {
      ...DEFAULT_RESUME_DATA,
      name: "Optimized CV (JSON Parse Mismatch)",
      summary: "We optimized your resume, but the AI response could not be parsed as structured JSON. You can copy the raw generated text below:",
      experience: [
        {
          role: "Optimized Text Block",
          company: "AI Output",
          period: "Review Raw",
          highlights: [
            "We were unable to structure the data automatically. Here is the raw response snippet:",
            responseText.slice(0, 1000)
          ]
        }
      ]
    };
    return fallback;
  }
}

/**
 * Generates a tailored Cover Letter mapping CV experience to the JD.
 */
export async function generateCoverLetter(cvText: string, jdText: string): Promise<string> {
  const { apiKey, model } = getAISettings();

  const prompt = `
You are a Professional Career Advisor and Cover Letter Writer.
Write a high-impact, tailored Cover Letter mapping the candidate's experiences from their CV onto the target Job Description.

---
TARGET JOB DESCRIPTION:
${jdText}

---
CANDIDATE CV:
${cvText}

---
INSTRUCTIONS:
1. Format as a professional business letter. Use placeholders for contact info if not clearly present.
2. Structure:
   - Paragraph 1: Catchy opening identifying the role and expressing enthusiasm.
   - Paragraph 2: Core technical achievements from the CV matching the main hard skills in the JD.
   - Paragraph 3: Leadership/soft-skills or collaborative success matching the style of the JD.
   - Paragraph 4: Strong closing statement with call to action.
3. Be professional, engaging, and persuasive.
4. Return ONLY the complete cover letter text. Do not add introductory chit-chat.
`;

  return callGemini(prompt, apiKey, model);
}

/**
 * Generates LinkedIn Networking text for HR.
 * Strictly constrained to 200 characters.
 */
export async function generateLinkedInMessage(
  cvText: string,
  jdText: string,
  hrName: string = "Hiring Manager"
): Promise<string> {
  const { apiKey, model } = getAISettings();

  const prompt = `
You are a recruiting expert. Write a short, high-impact LinkedIn Connection Request message.
It is targeted at: ${hrName}.
It should briefly pitch the candidate (summarized in the CV) for the target role (in the Job Description).

---
TARGET JOB DESCRIPTION:
${jdText}

---
CANDIDATE CV SUMMARY:
${cvText.slice(0, 1000)}... (truncated for context limit)

---
CRITICAL CONSTRAINT:
The message MUST be 200 characters or fewer, including spaces. This is a strict character cap for standard connection notes.

---
INSTRUCTIONS:
1. Make it polite, brief, and action-oriented.
2. Mention the role and why you're connecting.
3. Return ONLY the networking copy message itself. Absolutely no quotes, introductory chat, or formatting tags. Do not exceed 200 characters.
`;

  const response = await callGemini(prompt, apiKey, model);
  
  // Strict client-side truncation safety to ensure the constraint is respected
  let cleaned = response.replace(/^"|"$/g, '').trim();
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 197) + "...";
  }
  return cleaned;
}

/**
 * Queries Google's models endpoint to test if the API key has active access
 * and return the names of the models available.
 */
export async function testAPIKey(apiKey: string): Promise<string[]> {
  if (!apiKey) {
    throw new Error("API Key is empty.");
  }
  
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(message);
  }
  
  const data = await res.json();
  const models = data.models || [];
  return models.map((m: any) => m.name.replace("models/", ""));
}

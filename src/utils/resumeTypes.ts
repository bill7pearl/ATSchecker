/**
 * TypeScript definitions for the Structured Resume Builder schema.
 */

export interface ResumeContact {
  email: string;
  phone: string;
  location: string;
  linkedin: string;
}

export interface ResumeExperience {
  role: string;
  company: string;
  period: string;
  highlights: string[];
}

export interface ResumeEducation {
  degree: string;
  school: string;
  period: string;
}

export interface ResumeSkills {
  hard: string[];
  soft: string[];
}

export interface ResumeData {
  name: string;
  title: string;
  summary: string;
  contact: ResumeContact;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: ResumeSkills;
}

/**
 * Default fallback resume state.
 */
export const DEFAULT_RESUME_DATA: ResumeData = {
  name: "John Doe",
  title: "Professional Title",
  summary: "Brief professional summary describing core skills and career objectives.",
  contact: {
    email: "john.doe@email.com",
    phone: "+1 (555) 019-2834",
    location: "San Francisco, CA",
    linkedin: "linkedin.com/in/johndoe",
  },
  experience: [
    {
      role: "Job Title",
      company: "Company Name",
      period: "2023 - Present",
      highlights: [
        "Delivered project key features, improving system performance by 25%.",
        "Collaborated with cross-functional engineering teams to implement scalable modules.",
      ],
    },
  ],
  education: [
    {
      degree: "B.S. in Computer Science",
      school: "University Name",
      period: "2019 - 2023",
    },
  ],
  skills: {
    hard: ["JavaScript", "TypeScript", "React", "Next.js", "CSS"],
    soft: ["Communication", "Problem Solving", "Collaboration"],
  },
};

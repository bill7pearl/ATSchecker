"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Sparkles,
  Settings,
  History,
  Linkedin,
  FileEdit,
  Copy,
  Download,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Briefcase,
  ExternalLink
} from "lucide-react";

// Utilities imports
import {
  analyzeCV,
  SkillItem,
  StructuralFlag,
  ATSAnalysisResult
} from "../utils/atsAnalyzer";
import {
  getActivityLogs,
  logActivity,
  clearActivityLogs,
  ActivityLog
} from "../utils/localStorageLog";
import {
  getAISettings,
  saveAISettings,
  generateOptimizedCV,
  generateCoverLetter,
  generateLinkedInMessage,
  testAPIKey
} from "../utils/ai";
import { extractTextFromPDF } from "../utils/pdfWorker";
import { ResumeData, DEFAULT_RESUME_DATA } from "../utils/resumeTypes";

// Helper to serialize ResumeData structure to flat plain text for ATS keyword scanning comparison
const serializeResumeData = (data: ResumeData): string => {
  if (!data) return "";
  const parts: string[] = [];
  
  if (data.name) parts.push(data.name);
  if (data.title) parts.push(data.title);
  
  if (data.contact) {
    if (data.contact.email) parts.push(data.contact.email);
    if (data.contact.phone) parts.push(data.contact.phone);
    if (data.contact.location) parts.push(data.contact.location);
    if (data.contact.linkedin) parts.push(data.contact.linkedin);
  }
  
  if (data.summary) parts.push(data.summary);
  
  if (data.experience && Array.isArray(data.experience)) {
    data.experience.forEach((exp) => {
      if (exp.role) parts.push(exp.role);
      if (exp.company) parts.push(exp.company);
      if (exp.period) parts.push(exp.period);
      if (exp.highlights && Array.isArray(exp.highlights)) {
        parts.push(...exp.highlights);
      }
    });
  }
  
  if (data.education && Array.isArray(data.education)) {
    data.education.forEach((edu) => {
      if (edu.degree) parts.push(edu.degree);
      if (edu.school) parts.push(edu.school);
      if (edu.period) parts.push(edu.period);
    });
  }
  
  if (data.skills) {
    if (data.skills.hard && Array.isArray(data.skills.hard)) {
      parts.push(...data.skills.hard);
    }
    if (data.skills.soft && Array.isArray(data.skills.soft)) {
      parts.push(...data.skills.soft);
    }
  }
  
  return parts.filter(Boolean).join(" ");
};

type TabId = "dashboard" | "ats-scan" | "cv-optimize" | "cover-letter" | "linkedin" | "settings";

export default function Home() {
  // Navigation / Shell Tab State
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [isMounted, setIsMounted] = useState(false);
  const [cvSource, setCvSource] = useState<"original" | "optimized">("original");
  const [liveMatchScore, setLiveMatchScore] = useState<number | null>(null);

  // API Key Settings State
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [testResultList, setTestResultList] = useState<string[] | null>(null);
  const [testErrorMsg, setTestErrorMsg] = useState("");
  const [isTestingKey, setIsTestingKey] = useState(false);

  // User Data States
  const [cvText, setCvText] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  
  // PDF Parsing status states
  const [parsingProgress, setParsingProgress] = useState<{ page: number; total: number } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // Scan & Analysis outputs
  const [analysisResult, setAnalysisResult] = useState<ATSAnalysisResult | null>(null);
  const [isScanned, setIsScanned] = useState(false);

  // AI Generation Loading & Output States
  const [optimizedCV, setOptimizedCV] = useState<ResumeData | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [optError, setOptError] = useState("");
  const [showSummary, setShowSummary] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<"classic" | "modern" | "tech">("classic");
  const [fontSizeAdjust, setFontSizeAdjust] = useState<"small" | "medium" | "large">("medium");
  const [lineSpacingAdjust, setLineSpacingAdjust] = useState<"compact" | "normal" | "spacious">("normal");

  const [coverLetter, setCoverLetter] = useState("");
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);
  const [clError, setClError] = useState("");

  const [linkedinMsg, setLinkedinMsg] = useState("");
  const [linkedinTarget, setLinkedinTarget] = useState("Hiring Manager");
  const [isGeneratingLI, setIsGeneratingLI] = useState(false);
  const [liError, setLiError] = useState("");

  // Copy Feedback triggers
  const [copiedTextType, setCopiedTextType] = useState<string | null>(null);

  // Local Audit Logs ledger
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Drag and drop border active trigger
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========================================================
  // Lifecycle Hook: Load localStorage on mount & listen to changes
  // ========================================================
  useEffect(() => {
    setIsMounted(true);
    
    // Load local settings
    const settings = getAISettings();
    setApiKey(settings.apiKey);
    setSelectedModel(settings.model);
    
    // Load local logs
    setActivityLogs(getActivityLogs());
    
    // Sync UI on local log events
    const handleLogUpdate = () => {
      setActivityLogs(getActivityLogs());
    };
    window.addEventListener("activity_log_updated", handleLogUpdate);
    
    return () => {
      window.removeEventListener("activity_log_updated", handleLogUpdate);
    };
  }, []);

  // ========================================================
  // Lifecycle Hook: Calculate live match score of optimized CV in real time
  // ========================================================
  useEffect(() => {
    if (optimizedCV && jobDescription.trim()) {
      try {
        const text = serializeResumeData(optimizedCV);
        const result = analyzeCV(text, jobDescription);
        setLiveMatchScore(result.matchPercentage);
      } catch (err) {
        console.error("Failed to calculate live score:", err);
      }
    } else {
      setLiveMatchScore(null);
    }
  }, [optimizedCV, jobDescription]);

  // Helper trigger to copy content to clipboard
  const handleCopyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTextType(type);
    logActivity("Content Copied", `Copied generated text for ${type} to clipboard.`);
    setTimeout(() => setCopiedTextType(null), 2500);
  };

  // Helper trigger to download content as file
  const handleDownloadFile = (text: string, filename: string, type: string) => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logActivity("File Exported", `Exported ${type} to file: ${filename}`);
  };

  // Render structured ResumeData into custom styled templates
  const renderResumeTemplate = (data: ResumeData | null) => {
    if (!data) return <p className="text-slate-400 italic text-center py-12">No CV content generated yet. Go scan and optimize your CV first.</p>;

    // Base font size & line height configs based on state
    const sizeClasses = {
      small: { body: "text-[11px]", h4: "text-xs font-bold", h3: "text-xs font-bold", h2: "text-lg" },
      medium: { body: "text-xs", h4: "text-xs font-bold", h3: "text-sm font-bold", h2: "text-xl" },
      large: { body: "text-sm", h4: "text-sm font-bold", h3: "text-base font-bold", h2: "text-2xl" },
    }[fontSizeAdjust];

    const spacingClasses = {
      compact: { list: "space-y-0.5", sectionGap: "mt-3", itemGap: "mt-1" },
      normal: { list: "space-y-1", sectionGap: "mt-4.5", itemGap: "mt-2" },
      spacious: { list: "space-y-2", sectionGap: "mt-6", itemGap: "mt-3.5" },
    }[lineSpacingAdjust];

    // Template 1: Classic Executive (centered layout)
    if (selectedTemplate === "classic") {
      return (
        <div className={`w-full ${sizeClasses.body} text-[#1a1a1a]`}>
          {/* Header */}
          <div className="text-center border-b border-slate-900 pb-2">
            <h1 className={`${sizeClasses.h2} font-black uppercase tracking-tight text-black`}>{data.name}</h1>
            <p className="text-xs font-bold text-slate-700 tracking-wide mt-0.5 uppercase">{data.title}</p>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-slate-650 mt-1.5 text-[10px] sm:text-xs">
              {data.contact.email && <span>✉ {data.contact.email}</span>}
              {data.contact.phone && <span>☎ {data.contact.phone}</span>}
              {data.contact.location && <span>📍 {data.contact.location}</span>}
              {data.contact.linkedin && <span>🔗 {data.contact.linkedin}</span>}
            </div>
          </div>

          {/* Summary */}
          {showSummary && data.summary && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-bold text-black border-b border-slate-300 pb-0.5 uppercase tracking-wide`}>Professional Summary</h2>
              <p className="text-slate-750 mt-1 leading-relaxed text-justify">{data.summary}</p>
            </div>
          )}

          {/* Experience */}
          {data.experience && data.experience.length > 0 && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-bold text-black border-b border-slate-300 pb-0.5 uppercase tracking-wide`}>Professional Experience</h2>
              <div className="space-y-3 mt-1.5">
                {data.experience.map((exp, idx) => (
                  <div key={idx} className={spacingClasses.itemGap}>
                    <div className="flex justify-between items-baseline flex-wrap font-bold text-black">
                      <span className="text-[11px] font-bold">{exp.role}</span>
                      <span className="text-[10px] text-slate-500 font-normal">{exp.period}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-700">{exp.company}</p>
                    <ul className={`list-disc ml-5 mt-0.5 text-slate-700 ${spacingClasses.list}`}>
                      {exp.highlights.map((bullet, bIdx) => (
                        <li key={bIdx} className="leading-relaxed">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {data.education && data.education.length > 0 && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-bold text-black border-b border-slate-300 pb-0.5 uppercase tracking-wide`}>Education</h2>
              <div className="space-y-2 mt-1.5">
                {data.education.map((edu, idx) => (
                  <div key={idx} className="flex justify-between items-baseline flex-wrap text-[11px]">
                    <div>
                      <span className="font-bold text-black">{edu.degree}</span>
                      <span className="text-slate-600 font-medium"> — {edu.school}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{edu.period}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {((data.skills?.hard && data.skills.hard.length > 0) || (data.skills?.soft && data.skills.soft.length > 0)) && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-bold text-black border-b border-slate-300 pb-0.5 uppercase tracking-wide`}>Skills</h2>
              <div className="space-y-1 mt-1.5 text-[11px]">
                {data.skills.hard && data.skills.hard.length > 0 && (
                  <p className="text-slate-700">
                    <strong className="text-black font-semibold">Technical Expertise: </strong>
                    {data.skills.hard.join(", ")}
                  </p>
                )}
                {data.skills.soft && data.skills.soft.length > 0 && (
                  <p className="text-slate-700">
                    <strong className="text-black font-semibold">Core Competencies: </strong>
                    {data.skills.soft.join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Template 2: Modern Sidebar (two-column layout)
    if (selectedTemplate === "modern") {
      return (
        <div className={`w-full ${sizeClasses.body} text-[#2d3748] grid grid-cols-1 md:grid-cols-3 gap-6`}>
          {/* Left Column (Sidebar) */}
          <div className="md:col-span-1 border-r border-slate-200 pr-4 space-y-4">
            <div>
              <h1 className={`${sizeClasses.h3} font-black text-slate-900 leading-tight uppercase`}>{data.name}</h1>
              <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wide mt-0.5">{data.title}</p>
            </div>

            <div className="space-y-2 text-[10px] text-slate-600 pt-3 border-t border-slate-100">
              <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-widest">Contact</h4>
              {data.contact.email && <p className="truncate">✉ {data.contact.email}</p>}
              {data.contact.phone && <p>☎ {data.contact.phone}</p>}
              {data.contact.location && <p>📍 {data.contact.location}</p>}
              {data.contact.linkedin && <p className="truncate">🔗 {data.contact.linkedin}</p>}
            </div>

            {data.skills?.hard && data.skills.hard.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-widest">Core Tech</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.skills.hard.map((skill, index) => (
                    <span key={index} className="text-[9px] bg-slate-100 text-slate-800 font-semibold px-1.5 py-0.5 rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.skills?.soft && data.skills.soft.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-widest">Soft Skills</h4>
                <ul className="space-y-0.5 text-slate-650 list-disc ml-4 text-[10px]">
                  {data.skills.soft.map((skill, index) => (
                    <li key={index}>{skill}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column (Main content) */}
          <div className="md:col-span-2 space-y-4">
            {/* Summary */}
            {showSummary && data.summary && (
              <div>
                <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">About Me</h2>
                <p className="text-slate-700 leading-relaxed text-justify text-[11px]">{data.summary}</p>
              </div>
            )}

            {/* Experience */}
            {data.experience && data.experience.length > 0 && (
              <div>
                <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Experience</h2>
                <div className="space-y-3">
                  {data.experience.map((exp, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-baseline flex-wrap">
                        <h4 className="font-bold text-slate-900 text-[11px]">{exp.role}</h4>
                        <span className="text-[9px] text-slate-500">{exp.period}</span>
                      </div>
                      <p className="text-[9px] font-bold text-primary-700">{exp.company}</p>
                      <ul className="list-disc ml-4 mt-0.5 text-[10px] text-slate-600 space-y-0.5">
                        {exp.highlights.map((bullet, bIdx) => (
                          <li key={bIdx} className="leading-relaxed">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {data.education && data.education.length > 0 && (
              <div>
                <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Education</h2>
                <div className="space-y-2">
                  {data.education.map((edu, idx) => (
                    <div key={idx} className="flex justify-between items-baseline flex-wrap text-[10px]">
                      <div>
                        <strong className="text-slate-900 font-bold">{edu.degree}</strong>
                        <span className="text-slate-500"> — {edu.school}</span>
                      </div>
                      <span className="text-[9px] text-slate-500">{edu.period}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Template 3: Tech Accent (Modern left sidebar accents)
    if (selectedTemplate === "tech") {
      return (
        <div className={`w-full ${sizeClasses.body} text-[#1f2937]`}>
          {/* Header */}
          <div className="border-l-4 border-primary-600 pl-3.5 py-0.5">
            <h1 className={`${sizeClasses.h2} font-black text-slate-900 tracking-tight leading-tight`}>{data.name}</h1>
            <p className="text-xs font-bold text-primary-600 tracking-wider uppercase mt-0.5">{data.title}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500 mt-1.5 text-[10px] sm:text-xs">
              {data.contact.email && <span>✉ {data.contact.email}</span>}
              {data.contact.phone && <span>☎ {data.contact.phone}</span>}
              {data.contact.location && <span>📍 {data.contact.location}</span>}
              {data.contact.linkedin && <span>🔗 {data.contact.linkedin}</span>}
            </div>
          </div>

          {/* Summary */}
          {showSummary && data.summary && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-extrabold text-slate-900 uppercase tracking-wider text-primary-600 border-b-2 border-slate-100 pb-0.5`}>
                Summary
              </h2>
              <p className="text-slate-700 mt-1.5 leading-relaxed text-justify">{data.summary}</p>
            </div>
          )}

          {/* Experience */}
          {data.experience && data.experience.length > 0 && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-extrabold text-slate-900 uppercase tracking-wider text-primary-600 border-b-2 border-slate-100 pb-0.5`}>
                Experience
              </h2>
              <div className="space-y-3 mt-1.5">
                {data.experience.map((exp, idx) => (
                  <div key={idx} className={spacingClasses.itemGap}>
                    <div className="flex justify-between items-baseline flex-wrap">
                      <h4 className="text-[11px] font-bold text-slate-900">{exp.role}</h4>
                      <span className="text-[10px] text-primary-600 font-semibold">{exp.period}</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500">{exp.company}</p>
                    <ul className={`list-disc ml-5 mt-0.5 text-slate-700 ${spacingClasses.list}`}>
                      {exp.highlights.map((bullet, bIdx) => (
                        <li key={bIdx} className="leading-relaxed">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {data.education && data.education.length > 0 && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-extrabold text-slate-900 uppercase tracking-wider text-primary-600 border-b-2 border-slate-100 pb-0.5`}>
                Education
              </h2>
              <div className="space-y-2 mt-1.5">
                {data.education.map((edu, idx) => (
                  <div key={idx} className="flex justify-between items-baseline flex-wrap text-[11px]">
                    <div>
                      <strong className="text-slate-900 font-bold">{edu.degree}</strong>
                      <span className="text-slate-500"> — {edu.school}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{edu.period}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {((data.skills?.hard && data.skills.hard.length > 0) || (data.skills?.soft && data.skills.soft.length > 0)) && (
            <div className={spacingClasses.sectionGap}>
              <h2 className={`${sizeClasses.h3} font-extrabold text-slate-900 uppercase tracking-wider text-primary-600 border-b-2 border-slate-100 pb-0.5`}>
                Skills
              </h2>
              <div className="space-y-2 mt-2">
                {data.skills.hard && data.skills.hard.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-800 mr-1">Tech Stack:</span>
                    {data.skills.hard.map((skill, index) => (
                      <span key={index} className="text-[9px] border border-primary-500/20 bg-primary-50/10 text-primary-700 px-2 py-0.5 rounded font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                {data.skills.soft && data.skills.soft.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-800 mr-1">Professional:</span>
                    {data.skills.soft.map((skill, index) => (
                      <span key={index} className="text-[9px] border border-slate-200 bg-slate-50 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const handlePrintResume = () => {
    logActivity("CV Printed", "Opened print dialog to save optimized CV as PDF.");
    window.print();
  };

  const handleDownloadAsImage = async () => {
    if (!optimizedCV) return;
    setIsExporting(true);
    
    try {
      if (!(window as any).html2canvas) {
        logActivity("Loading Library", "Loading html2canvas from CDN...");
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load html2canvas."));
          document.body.appendChild(script);
        });
      }

      const html2canvas = (window as any).html2canvas;
      const element = document.getElementById("cv-resume-preview-sheet");
      if (!element) {
        alert("Resume preview sheet element not found.");
        return;
      }

      logActivity("Exporting Image", "Generating layout-preserved PNG...");

      // Temporarily normalize elements for a perfect clean screenshot capture
      const originalTransform = element.style.transform;
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      const originalMargin = element.style.margin;
      const originalShadow = element.style.boxShadow;

      element.style.transform = "none";
      element.style.width = "820px"; // locks aspect-ratio width matching preview standard
      element.style.maxWidth = "820px";
      element.style.margin = "0 auto";
      element.style.boxShadow = "none";

      const canvas = await html2canvas(element, {
        scale: 2.2, // Retina scale resolution
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      element.style.transform = originalTransform;
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.margin = originalMargin;
      element.style.boxShadow = originalShadow;

      const dataUrl = canvas.toDataURL("image/png");
      const filename = `${optimizedCV.name.trim().replace(/\s+/g, "_")}_optimized_CV.png`;
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logActivity("Image Exported", `Successfully downloaded resume as PNG image: ${filename}`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to export image: ${err.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAsPDF = async () => {
    if (!optimizedCV) return;
    setIsExporting(true);
    
    try {
      if (!(window as any).jspdf) {
        logActivity("Loading Library", "Loading jsPDF from CDN...");
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load jsPDF."));
          document.body.appendChild(script);
        });
      }

      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 15;
      
      let y = 15;
      
      const checkPageBoundary = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          // Redraw sidebar background if in modern template
          if (selectedTemplate === "modern") {
            drawModernSidebarBg();
          }
        }
      };

      const drawModernSidebarBg = () => {
        pdf.setFillColor(248, 250, 252); // slate 50
        pdf.rect(0, 0, 70, pageHeight, "F");
        pdf.setDrawColor(226, 232, 240); // slate 200
        pdf.setLineWidth(0.3);
        pdf.line(70, 0, 70, pageHeight);
      };

      // Theme Colors
      const primaryColor = selectedTemplate === "tech" ? [37, 99, 235] : [17, 24, 39]; // tech is blue, else slate 900
      
      // ==========================================
      // Layout 1: Modern Sidebar Template (Left Sidebar 0-70mm, Content 75-195mm)
      // ==========================================
      if (selectedTemplate === "modern") {
        drawModernSidebarBg();
        
        // Sidebar Content (Contact & Skills)
        let sideY = 15;
        
        // Name
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.setTextColor(17, 24, 39);
        const nameLines = pdf.splitTextToSize(optimizedCV.name, 50);
        nameLines.forEach((line: string) => {
          pdf.text(line, 10, sideY);
          sideY += 5.5;
        });
        
        // Title
        if (optimizedCV.title) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(37, 99, 235);
          pdf.text(optimizedCV.title.toUpperCase(), 10, sideY);
          sideY += 8;
        }
        
        // Contact Header
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text("CONTACT", 10, sideY);
        sideY += 4.5;
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(55, 65, 81);
        
        if (optimizedCV.contact.email) {
          pdf.text(optimizedCV.contact.email, 10, sideY);
          sideY += 4.2;
        }
        if (optimizedCV.contact.phone) {
          pdf.text(optimizedCV.contact.phone, 10, sideY);
          sideY += 4.2;
        }
        if (optimizedCV.contact.location) {
          pdf.text(optimizedCV.contact.location, 10, sideY);
          sideY += 4.2;
        }
        if (optimizedCV.contact.linkedin) {
          const lLines = pdf.splitTextToSize(optimizedCV.contact.linkedin, 50);
          lLines.forEach((line: string) => {
            pdf.text(line, 10, sideY);
            sideY += 4.2;
          });
        }
        sideY += 6;
        
        // Hard Skills
        if (optimizedCV.skills?.hard && optimizedCV.skills.hard.length > 0) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(100, 116, 139);
          pdf.text("TECHNICAL EXPERTISE", 10, sideY);
          sideY += 5;
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(55, 65, 81);
          optimizedCV.skills.hard.forEach((skill) => {
            const skillLines = pdf.splitTextToSize(`- ${skill}`, 50);
            skillLines.forEach((line: string) => {
              pdf.text(line, 10, sideY);
              sideY += 4;
            });
          });
          sideY += 6;
        }

        // Soft Skills
        if (optimizedCV.skills?.soft && optimizedCV.skills.soft.length > 0) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(100, 116, 139);
          pdf.text("CORE COMPETENCIES", 10, sideY);
          sideY += 5;
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(55, 65, 81);
          optimizedCV.skills.soft.forEach((skill) => {
            const skillLines = pdf.splitTextToSize(`- ${skill}`, 50);
            skillLines.forEach((line: string) => {
              pdf.text(line, 10, sideY);
              sideY += 4;
            });
          });
        }

        // Right Column Content (Summary, Experience, Education)
        y = 15;
        const rightWidth = pageWidth - 75 - margin; // 120
        
        const renderRightHeader = (title: string) => {
          checkPageBoundary(12);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10.5);
          pdf.setTextColor(17, 24, 39);
          pdf.text(title.toUpperCase(), 75, y);
          y += 2.5;
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.3);
          pdf.line(75, y, pageWidth - margin, y);
          y += 5;
        };

        // Summary
        if (optimizedCV.summary && showSummary) {
          renderRightHeader("About Me");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(55, 65, 81);
          const lines = pdf.splitTextToSize(optimizedCV.summary, rightWidth);
          lines.forEach((line: string) => {
            checkPageBoundary(5);
            pdf.text(line, 75, y);
            y += 4.5;
          });
          y += 4;
        }

        // Experience
        if (optimizedCV.experience && optimizedCV.experience.length > 0) {
          renderRightHeader("Experience");
          optimizedCV.experience.forEach((exp) => {
            checkPageBoundary(15);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9.5);
            pdf.setTextColor(17, 24, 39);
            pdf.text(exp.role, 75, y);
            
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8.5);
            pdf.setTextColor(100, 116, 139);
            const periodWidth = pdf.getTextWidth(exp.period);
            pdf.text(exp.period, pageWidth - margin - periodWidth, y);
            y += 4.5;
            
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.5);
            pdf.setTextColor(37, 99, 235);
            pdf.text(exp.company, 75, y);
            y += 5;

            if (exp.highlights && exp.highlights.length > 0) {
              pdf.setFont("helvetica", "normal");
              pdf.setFontSize(8.5);
              pdf.setTextColor(55, 65, 81);
              exp.highlights.forEach((bullet) => {
                if (!bullet.trim()) return;
                const bulletLines = pdf.splitTextToSize(bullet, rightWidth - 5);
                bulletLines.forEach((line: string, index: number) => {
                  checkPageBoundary(4.5);
                  if (index === 0) {
                    pdf.setFillColor(100, 116, 139);
                    pdf.circle(77.5, y - 0.9, 0.45, "F");
                  }
                  pdf.text(line, 81, y);
                  y += 4;
                });
              });
            }
            y += 4;
          });
        }

        // Education
        if (optimizedCV.education && optimizedCV.education.length > 0) {
          renderRightHeader("Education");
          optimizedCV.education.forEach((edu) => {
            checkPageBoundary(10);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9.5);
            pdf.setTextColor(17, 24, 39);
            pdf.text(edu.degree, 75, y);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8.5);
            pdf.setTextColor(100, 116, 139);
            const pWidth = pdf.getTextWidth(edu.period);
            pdf.text(edu.period, pageWidth - margin - pWidth, y);
            y += 4.5;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.setTextColor(75, 85, 99);
            pdf.text(edu.school, 75, y);
            y += 6;
          });
        }
      }
      
      // ==========================================
      // Layout 2: Classic / Tech Template (Full width centered / accented)
      // ==========================================
      else {
        const contentWidth = pageWidth - (margin * 2);
        
        // Tech Left Border Accent decoration
        if (selectedTemplate === "tech") {
          pdf.setFillColor(37, 99, 235); // Tech Accent blue
          pdf.rect(margin, y, 3, 14, "F");
        }

        // Header (Name & Title)
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.setTextColor(17, 24, 39);
        const nameText = optimizedCV.name;
        const nameX = selectedTemplate === "tech" ? margin + 6 : (pageWidth - pdf.getTextWidth(nameText)) / 2;
        pdf.text(nameText, nameX, y + 5);
        y += 10;
        
        if (optimizedCV.title) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10.5);
          pdf.setTextColor(37, 99, 235);
          const titleText = optimizedCV.title.toUpperCase();
          const titleX = selectedTemplate === "tech" ? margin + 6 : (pageWidth - pdf.getTextWidth(titleText)) / 2;
          pdf.text(titleText, titleX, y);
          y += 5.5;
        }

        // Contact info line
        const contactParts = [];
        if (optimizedCV.contact.email) contactParts.push(optimizedCV.contact.email);
        if (optimizedCV.contact.phone) contactParts.push(optimizedCV.contact.phone);
        if (optimizedCV.contact.location) contactParts.push(optimizedCV.contact.location);
        if (optimizedCV.contact.linkedin) contactParts.push(optimizedCV.contact.linkedin);
        
        const contactStr = contactParts.join("  |  ");
        if (contactStr) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8.5);
          pdf.setTextColor(100, 116, 139);
          const contactX = selectedTemplate === "tech" ? margin + 6 : (pageWidth - pdf.getTextWidth(contactStr)) / 2;
          pdf.text(contactStr, contactX, y);
          y += 7;
        }

        // Horizontal line
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.4);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 6;

        const renderFullHeader = (title: string) => {
          checkPageBoundary(15);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.text(title.toUpperCase(), margin, y);
          y += 2.5;
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.3);
          pdf.line(margin, y, pageWidth - margin, y);
          y += 5;
        };

        // Summary
        if (optimizedCV.summary && showSummary) {
          renderFullHeader("Professional Summary");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9.5);
          pdf.setTextColor(55, 65, 81);
          const lines = pdf.splitTextToSize(optimizedCV.summary, contentWidth);
          lines.forEach((line: string) => {
            checkPageBoundary(5);
            pdf.text(line, margin, y);
            y += 4.5;
          });
          y += 4;
        }

        // Experience
        if (optimizedCV.experience && optimizedCV.experience.length > 0) {
          renderFullHeader("Professional Experience");
          optimizedCV.experience.forEach((exp) => {
            checkPageBoundary(15);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.setTextColor(17, 24, 39);
            pdf.text(exp.role, margin, y);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.setTextColor(100, 116, 139);
            const pWidth = pdf.getTextWidth(exp.period);
            pdf.text(exp.period, pageWidth - margin - pWidth, y);
            y += 4.5;

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.setTextColor(selectedTemplate === "tech" ? 37 : 75, selectedTemplate === "tech" ? 99 : 85, selectedTemplate === "tech" ? 235 : 99);
            pdf.text(exp.company, margin, y);
            y += 5;

            if (exp.highlights && exp.highlights.length > 0) {
              pdf.setFont("helvetica", "normal");
              pdf.setFontSize(9);
              pdf.setTextColor(55, 65, 81);
              exp.highlights.forEach((bullet) => {
                if (!bullet.trim()) return;
                const bulletLines = pdf.splitTextToSize(bullet, contentWidth - 6);
                bulletLines.forEach((line: string, index: number) => {
                  checkPageBoundary(4.5);
                  if (index === 0) {
                    pdf.setFillColor(100, 116, 139);
                    pdf.circle(margin + 2.5, y - 1.0, 0.5, "F");
                  }
                  pdf.text(line, margin + 6, y);
                  y += 4.2;
                });
              });
            }
            y += 4;
          });
        }

        // Education
        if (optimizedCV.education && optimizedCV.education.length > 0) {
          renderFullHeader("Education");
          optimizedCV.education.forEach((edu) => {
            checkPageBoundary(10);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.setTextColor(17, 24, 39);
            pdf.text(edu.degree, margin, y);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.setTextColor(100, 116, 139);
            const pWidth = pdf.getTextWidth(edu.period);
            pdf.text(edu.period, pageWidth - margin - pWidth, y);
            y += 4.5;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9.5);
            pdf.setTextColor(75, 85, 99);
            pdf.text(edu.school, margin, y);
            y += 6;
          });
        }

        // Skills
        const hasHard = optimizedCV.skills?.hard && optimizedCV.skills.hard.length > 0;
        const hasSoft = optimizedCV.skills?.soft && optimizedCV.skills.soft.length > 0;
        if (hasHard || hasSoft) {
          renderFullHeader("Skills");
          
          if (hasHard) {
            checkPageBoundary(10);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9.5);
            pdf.setTextColor(17, 24, 39);
            pdf.text("Technical Expertise: ", margin, y);
            
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(55, 65, 81);
            const labelWidth = pdf.getTextWidth("Technical Expertise: ");
            const listStr = optimizedCV.skills.hard.join(", ");
            const lines = pdf.splitTextToSize(listStr, contentWidth - labelWidth);
            lines.forEach((line: string, index: number) => {
              if (index > 0) {
                checkPageBoundary(5);
                pdf.text(line, margin, y);
              } else {
                pdf.text(line, margin + labelWidth, y);
              }
              y += 4.5;
            });
            y += 1.5;
          }

          if (hasSoft) {
            checkPageBoundary(10);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9.5);
            pdf.setTextColor(17, 24, 39);
            pdf.text("Core Competencies: ", margin, y);
            
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(55, 65, 81);
            const labelWidth = pdf.getTextWidth("Core Competencies: ");
            const listStr = optimizedCV.skills.soft.join(", ");
            const lines = pdf.splitTextToSize(listStr, contentWidth - labelWidth);
            lines.forEach((line: string, index: number) => {
              if (index > 0) {
                checkPageBoundary(5);
                pdf.text(line, margin, y);
              } else {
                pdf.text(line, margin + labelWidth, y);
              }
              y += 4.5;
            });
          }
        }
      }
      
      const filename = `${optimizedCV.name.trim().replace(/\s+/g, "_")}_optimized_CV.pdf`;
      pdf.save(filename);
      logActivity("PDF Exported", `Successfully downloaded layout-preserved vector text PDF: ${filename}`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to export vector PDF: ${err.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ========================================================
  // Feature A: PDF Drag & Drop and Raw Extraction Handlers
  // ========================================================
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setParseError("");

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processSelectedFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError("");
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setParseError("Only PDF files are supported. Please upload a standard PDF resume.");
      return;
    }

    setIsParsing(true);
    setCvFileName(file.name);
    setCvText("");
    setParsingProgress({ page: 0, total: 0 });

    try {
      const text = await extractTextFromPDF(file, (prog) => {
        setParsingProgress(prog);
      });
      
      setCvText(text);
      setCvSource("original");
      setParseError("");
      logActivity("CV Uploaded", `Successfully parsed file: ${file.name} (${text.split(/\s+/).length} words).`);
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || "Failed to extract text from PDF. Ensure the file is not copy-protected.");
      setCvFileName("");
      logActivity("Upload Error", `Parsing failed for: ${file.name}`);
    } finally {
      setIsParsing(false);
      setParsingProgress(null);
    }
  };

  // Core comparator match triggers
  const handleCalculateMatch = () => {
    const textToAnalyze = cvSource === "original" ? cvText : (optimizedCV ? serializeResumeData(optimizedCV) : "");
    if (!textToAnalyze) {
      setParseError(cvSource === "original" ? "Please upload a PDF resume first." : "Please generate the optimized CV first.");
      return;
    }
    if (!jobDescription.trim()) {
      setParseError("Please provide a target Job Description.");
      return;
    }

    try {
      const result = analyzeCV(textToAnalyze, jobDescription);
      setAnalysisResult(result);
      setIsScanned(true);
      logActivity("Match Calculated", `Calculated ATS Match score of ${result.matchPercentage}% using ${cvSource === "original" ? "Original CV" : "Optimized CV"} against Target Job Description.`);
      
      // Auto transition to view the results if scrolled
      window.scrollTo({ top: 350, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setParseError("Analysis computation error.");
    }
  };

  // ========================================================
  // Feature B: CV Optimization Generation Trigger
  // ========================================================
  const handleOptimizeCV = async () => {
    if (!cvText || !jobDescription || !analysisResult) {
      setOptError("Ensure you have uploaded a CV, added a Job Description, and computed the ATS match score first.");
      return;
    }

    const settings = getAISettings();
    if (!settings.apiKey) {
      setOptError("API Key is missing. Go to the Settings tab to configure your Gemini API Key.");
      return;
    }

    setIsOptimizing(true);
    setOptError("");
    setOptimizedCV("");

    try {
      const missingSkills = [
        ...analysisResult.hardSkills.filter(s => !s.matched).map(s => s.name),
        ...analysisResult.softSkills.filter(s => !s.matched).map(s => s.name),
        ...analysisResult.contextKeywords.filter(s => !s.matched).map(s => s.name)
      ];

      if (missingSkills.length === 0) {
        // If there are no missing keywords, optimize syntax general style
        missingSkills.push("enhance active verbs", "maximize technical clarity");
      }

      const generated = await generateOptimizedCV(cvText, jobDescription, missingSkills);
      setOptimizedCV(generated);
      logActivity("CV Optimized", "Generated optimized CV using client-side Gemini AI integration.");
    } catch (err: any) {
      console.error(err);
      setOptError(err.message || "Optimization request failed. Check API key configurations and network connectivity.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // ========================================================
  // Feature C: Cover Letter Generation Trigger
  // ========================================================
  const handleGenerateCoverLetter = async () => {
    if (!cvText || !jobDescription) {
      setClError("Please upload a CV and paste a target Job Description first.");
      return;
    }

    const settings = getAISettings();
    if (!settings.apiKey) {
      setClError("API Key is missing. Go to the Settings tab to configure your Gemini API Key.");
      return;
    }

    setIsGeneratingCL(true);
    setClError("");
    setCoverLetter("");

    try {
      const generated = await generateCoverLetter(cvText, jobDescription);
      setCoverLetter(generated);
      logActivity("Cover Letter Generated", "Successfully synthesized tailored cover letter via Gemini.");
    } catch (err: any) {
      console.error(err);
      setClError(err.message || "Cover Letter synthesis failed.");
    } finally {
      setIsGeneratingCL(false);
    }
  };

  // ========================================================
  // Feature D: LinkedIn Copy Message Trigger
  // ========================================================
  const handleGenerateLinkedIn = async () => {
    if (!cvText || !jobDescription) {
      setLiError("Please upload a CV and paste a target Job Description first.");
      return;
    }

    const settings = getAISettings();
    if (!settings.apiKey) {
      setLiError("API Key is missing. Go to the Settings tab to configure your Gemini API Key.");
      return;
    }

    setIsGeneratingLI(true);
    setLiError("");
    setLinkedinMsg("");

    try {
      const recipient = linkedinTarget.trim() || "Hiring Manager";
      const generated = await generateLinkedInMessage(cvText, jobDescription, recipient);
      setLinkedinMsg(generated);
      logActivity("LinkedIn Msg Generated", `Synthesized LinkedIn outreach card targeting ${recipient}.`);
    } catch (err: any) {
      console.error(err);
      setLiError(err.message || "LinkedIn outreach generation failed.");
    } finally {
      setIsGeneratingLI(false);
    }
  };

  // ========================================================
  // Feature E: API Key Save & Config Operations
  // ========================================================
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveAISettings({ apiKey, model: selectedModel });
    setSettingsSaved(true);
    logActivity("Settings Configured", `Saved API settings with model ${selectedModel}.`);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleTestAPIKey = async () => {
    if (!apiKey.trim()) {
      setTestErrorMsg("Please enter an API Key first.");
      return;
    }
    setIsTestingKey(true);
    setTestErrorMsg("");
    setTestResultList(null);
    try {
      const models = await testAPIKey(apiKey);
      setTestResultList(models);
      logActivity("API Tested", `API key tested successfully. Found ${models.length} accessible models.`);
    } catch (err: any) {
      console.error(err);
      setTestErrorMsg(err.message || "Failed to query models from Google API.");
      logActivity("API Test Failed", `Tested API key. Error: ${err.message || "Unknown error"}`);
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleClearAllLogs = () => {
    if (confirm("Are you sure you want to clear your local activity audit logs ledger?")) {
      clearActivityLogs();
      logActivity("Logs Purged", "Cleared all user activities logs ledger.");
    }
  };

  // Hydration guard loading
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-primary-500 w-8 h-8" />
          <span className="text-sm font-semibold tracking-wide">Loading ATS Engine...</span>
        </div>
      </div>
    );
  }

  // Dashboard calculation stats helpers
  const totalScans = activityLogs.filter(l => l.action === "Match Calculated").length;
  const lastScore = activityLogs.find(l => l.action === "Match Calculated")?.details.match(/\d+/) || ["-"];
  const averageScore = (() => {
    const scores = activityLogs
      .filter(l => l.action === "Match Calculated")
      .map(l => parseInt(l.details.match(/\d+/)?.[0] || "0"))
      .filter(Boolean);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  })();

  // Structured Resume Form Updaters
  const updateResumeField = (path: string, value: any) => {
    if (!optimizedCV) return;
    const updated = { ...optimizedCV };
    if (path === "name") updated.name = value;
    if (path === "title") updated.title = value;
    if (path === "summary") updated.summary = value;
    if (path.startsWith("contact.")) {
      const field = path.split(".")[1] as keyof typeof updated.contact;
      updated.contact = { ...updated.contact, [field]: value };
    }
    setOptimizedCV(updated);
  };

  const updateExperienceField = (index: number, field: string, value: any) => {
    if (!optimizedCV) return;
    const updated = { ...optimizedCV };
    const exp = [...updated.experience];
    exp[index] = { ...exp[index], [field]: value };
    updated.experience = exp;
    setOptimizedCV(updated);
  };

  const updateSkillsField = (category: "hard" | "soft", value: string) => {
    if (!optimizedCV) return;
    const updated = { ...optimizedCV };
    const arr = value.split(",").map(s => s.trim()).filter(Boolean);
    updated.skills = { ...updated.skills, [category]: arr };
    setOptimizedCV(updated);
  };

  const updateEducationField = (index: number, field: string, value: any) => {
    if (!optimizedCV) return;
    const updated = { ...optimizedCV };
    const edu = [...updated.education];
    edu[index] = { ...edu[index], [field]: value };
    updated.education = edu;
    setOptimizedCV(updated);
  };

  const renderFormEditor = () => {
    if (!optimizedCV) return null;

    return (
      <div className="space-y-5 max-h-[720px] overflow-y-auto pr-2.5">
        {/* Contact Info */}
        <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-900/60">
          <h4 className="text-xs font-bold text-primary-400 uppercase tracking-widest border-b border-slate-900 pb-1.5">1. Contact & Header</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Full Name</label>
              <input
                type="text"
                value={optimizedCV.name}
                onChange={(e) => updateResumeField("name", e.target.value)}
                className="cv-input text-xs py-1.5 px-3"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Professional Title</label>
              <input
                type="text"
                value={optimizedCV.title}
                onChange={(e) => updateResumeField("title", e.target.value)}
                className="cv-input text-xs py-1.5 px-3"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Email</label>
              <input
                type="text"
                value={optimizedCV.contact.email}
                onChange={(e) => updateResumeField("contact.email", e.target.value)}
                className="cv-input text-xs py-1.5 px-3"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Phone</label>
              <input
                type="text"
                value={optimizedCV.contact.phone}
                onChange={(e) => updateResumeField("contact.phone", e.target.value)}
                className="cv-input text-xs py-1.5 px-3"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Location</label>
              <input
                type="text"
                value={optimizedCV.contact.location}
                onChange={(e) => updateResumeField("contact.location", e.target.value)}
                className="cv-input text-xs py-1.5 px-3"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">LinkedIn Profile</label>
              <input
                type="text"
                value={optimizedCV.contact.linkedin}
                onChange={(e) => updateResumeField("contact.linkedin", e.target.value)}
                className="cv-input text-xs py-1.5 px-3"
              />
            </div>
          </div>
        </div>

        {/* Professional Summary */}
        <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-900/60">
          <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
            <h4 className="text-xs font-bold text-primary-400 uppercase tracking-widest">2. Summary</h4>
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                id="toggle-summary-checkbox"
                checked={showSummary}
                onChange={(e) => setShowSummary(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary-500 rounded bg-slate-950 border-slate-800"
              />
              <label htmlFor="toggle-summary-checkbox" className="text-[10px] text-slate-400 cursor-pointer">Include Summary</label>
            </div>
          </div>
          {showSummary && (
            <textarea
              value={optimizedCV.summary}
              onChange={(e) => updateResumeField("summary", e.target.value)}
              className="cv-textarea text-xs min-h-[90px] py-1.5 px-2.5"
              placeholder="Provide a brief summary profile..."
            />
          )}
        </div>

        {/* Experience Form List */}
        <div className="space-y-4 bg-slate-950/20 p-4 rounded-xl border border-slate-900/60">
          <h4 className="text-xs font-bold text-primary-400 uppercase tracking-widest border-b border-slate-900 pb-1.5">3. Work History</h4>
          {optimizedCV.experience.map((exp, index) => (
            <div key={index} className="space-y-2 border-b border-slate-900/50 pb-3 last:border-0 last:pb-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">Role Title</label>
                  <input
                    type="text"
                    value={exp.role}
                    onChange={(e) => updateExperienceField(index, "role", e.target.value)}
                    className="cv-input text-xs py-1 px-2.5"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">Company</label>
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => updateExperienceField(index, "company", e.target.value)}
                    className="cv-input text-xs py-1 px-2.5"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">Duration</label>
                <input
                  type="text"
                  value={exp.period}
                  onChange={(e) => updateExperienceField(index, "period", e.target.value)}
                  className="cv-input text-xs py-1 px-2.5"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">Highlights (One bullet per line)</label>
                <textarea
                  value={exp.highlights.join("\n")}
                  onChange={(e) => updateExperienceField(index, "highlights", e.target.value.split("\n"))}
                  className="cv-textarea text-xs min-h-[90px] py-1.5 px-2.5 font-sans leading-normal"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Skills Lists */}
        <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-900/60">
          <h4 className="text-xs font-bold text-primary-400 uppercase tracking-widest border-b border-slate-900 pb-1.5">4. Core Skills</h4>
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Tech Stack (Comma-separated)</label>
            <input
              type="text"
              value={optimizedCV.skills.hard.join(", ")}
              onChange={(e) => updateSkillsField("hard", e.target.value)}
              className="cv-input text-xs py-1.5 px-3"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Soft Skills (Comma-separated)</label>
            <input
              type="text"
              value={optimizedCV.skills.soft.join(", ")}
              onChange={(e) => updateSkillsField("soft", e.target.value)}
              className="cv-input text-xs py-1.5 px-3"
            />
          </div>
        </div>

        {/* Education Form List */}
        <div className="space-y-4 bg-slate-950/20 p-4 rounded-xl border border-slate-900/60">
          <h4 className="text-xs font-bold text-primary-400 uppercase tracking-widest border-b border-slate-900 pb-1.5">5. Education</h4>
          {optimizedCV.education.map((edu, index) => (
            <div key={index} className="space-y-2 border-b border-slate-900/50 pb-3 last:border-0 last:pb-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">Degree Title</label>
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) => updateEducationField(index, "degree", e.target.value)}
                    className="cv-input text-xs py-1 px-2.5"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">School</label>
                  <input
                    type="text"
                    value={edu.school}
                    onChange={(e) => updateEducationField(index, "school", e.target.value)}
                    className="cv-input text-xs py-1 px-2.5"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">Period</label>
                <input
                  type="text"
                  value={edu.period}
                  onChange={(e) => updateEducationField(index, "period", e.target.value)}
                  className="cv-input text-xs py-1 px-2.5"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCVOptimizeTab = () => {
    return (
      <div className="space-y-6">
        <div className="cv-card">
          <div className="cv-card__header flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h2 className="cv-card__title">
                <FileEdit className="text-primary-500 w-5 h-5" />
                Structured CV Optimizer & Form Engine
              </h2>
              <p className="cv-card__subtitle">Naturally inject keywords and format inside professional print templates</p>
            </div>
            
            <div className="flex gap-2 flex-wrap mt-3 sm:mt-0">
              {optimizedCV && (
                <button
                  onClick={() => setShowPrintPreview(!showPrintPreview)}
                  className="cv-button cv-button--secondary text-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showPrintPreview ? "Show Custom Form Editor" : "Fullscreen Print Layout"}
                </button>
              )}
              
              <button
                onClick={handleOptimizeCV}
                disabled={isOptimizing}
                className="cv-button cv-button--primary text-xs w-full sm:w-auto mt-3 sm:mt-0"
              >
                {isOptimizing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Optimizing CV Structure...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Run AI Optimizer
                  </>
                )}
              </button>
            </div>
          </div>

          {optError && (
            <div className="bg-danger-50/10 border border-danger-500/20 text-danger-500 rounded-xl p-3 flex gap-2 items-center text-xs mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{optError}</span>
            </div>
          )}

          {/* Settings Toolbar (Shown only after optimization results exist) */}
          {optimizedCV && (
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 mb-6 flex flex-wrap gap-4 items-center justify-between">
              {/* Template selection buttons */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Template Theme:</span>
                <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/60">
                  {(["classic", "modern", "tech"] as const).map((temp) => (
                    <button
                      key={temp}
                      onClick={() => setSelectedTemplate(temp)}
                      className={`text-[10px] font-bold px-3 py-1 rounded transition-colors uppercase ${
                        selectedTemplate === temp
                          ? "bg-primary-600 text-white shadow-md shadow-primary-500/10"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjust sizes */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Font Size:</span>
                  <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/60">
                    {(["small", "medium", "large"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSizeAdjust(size)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded transition-colors uppercase ${
                          fontSizeAdjust === size
                            ? "bg-slate-700 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Spacing:</span>
                  <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/60">
                    {(["compact", "normal", "spacious"] as const).map((spacing) => (
                      <button
                        key={spacing}
                        onClick={() => setLineSpacingAdjust(spacing)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded transition-colors uppercase ${
                          lineSpacingAdjust === spacing
                            ? "bg-slate-700 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {spacing}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Render editor UI panels based on status */}
          {!optimizedCV ? (
            <div className="text-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <FileEdit className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm max-w-sm mx-auto">
                Please upload a PDF resume, paste a target Job Description in the **ATS Matcher** tab, and click **Run AI Optimizer** above to build your template.
              </p>
            </div>
          ) : showPrintPreview ? (
            /* Fullscreen print preview panel */
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-900">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] text-slate-400">
                    📄 Full A4 layout page render. Browser headers and footers are suppressed automatically.
                  </span>
                  {liveMatchScore !== null && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      liveMatchScore >= 75
                        ? "bg-success-50/10 text-success-500 border-success-500/20"
                        : liveMatchScore >= 50
                        ? "bg-warning-50/10 text-warning-500 border-warning-500/20"
                        : "bg-danger-50/10 text-danger-500 border-danger-500/20"
                    }`}>
                      Live ATS Match: {liveMatchScore}%
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setCvSource("optimized");
                      setActiveTab("ats-scan");
                      setTimeout(() => {
                        const text = serializeResumeData(optimizedCV!);
                        const result = analyzeCV(text, jobDescription);
                        setAnalysisResult(result);
                        setIsScanned(true);
                        logActivity("Match Calculated", `Calculated ATS Match score of ${result.matchPercentage}% using Optimized CV against Target Job Description.`);
                      }, 50);
                    }}
                    className="cv-button cv-button--secondary text-xs py-1.5 px-3 font-bold"
                    title="Run full ATS diagnostics report"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                    Test ATS Match
                  </button>
                  <button
                    onClick={handlePrintResume}
                    className="cv-button cv-button--secondary text-xs py-1.5 px-3"
                  >
                    Print
                  </button>
                  <button
                    onClick={handleDownloadAsImage}
                    disabled={isExporting}
                    className="cv-button cv-button--secondary text-xs py-1.5 px-3"
                  >
                    Export PNG
                  </button>
                  <button
                    onClick={handleDownloadAsPDF}
                    disabled={isExporting}
                    className="cv-button cv-button--success text-xs py-1.5 px-4 shadow-md shadow-success-500/10"
                  >
                    {isExporting ? "Exporting..." : "Export Perfect PDF"}
                  </button>
                </div>
              </div>
              <div className="cv-resume-sheet" id="cv-resume-preview-sheet">
                {renderResumeTemplate(optimizedCV)}
              </div>
            </div>
          ) : (
            /* Split Edit-and-Preview screen layout */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Left Column: Form Editor */}
              <div className="flex flex-col bg-[#0e1726]/80 border border-slate-850 rounded-2xl p-4 shadow-lg h-[780px]">
                <div className="flex justify-between items-center pb-3 border-b border-slate-900 mb-4">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileEdit className="w-3.5 h-3.5 text-primary-500" />
                    CV Form Inputs
                  </span>
                  <span className="text-[10px] text-slate-400">Interactive live sync</span>
                </div>
                {renderFormEditor()}
              </div>

              {/* Right Column: Live Sheet Preview */}
              <div className="flex flex-col bg-[#0b101c] border border-slate-900 rounded-2xl p-4 shadow-lg h-[780px]">
                <div className="flex justify-between items-center pb-3 border-b border-slate-900 mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-primary-500" />
                      Live Page Preview
                    </span>
                    {liveMatchScore !== null && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        liveMatchScore >= 75
                          ? "bg-success-50/10 text-success-500 border-success-500/20"
                          : liveMatchScore >= 50
                          ? "bg-warning-50/10 text-warning-500 border-warning-500/20"
                          : "bg-danger-50/10 text-danger-500 border-danger-500/20"
                      }`}>
                        Live ATS: {liveMatchScore}%
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        setCvSource("optimized");
                        setActiveTab("ats-scan");
                        setTimeout(() => {
                          const text = serializeResumeData(optimizedCV!);
                          const result = analyzeCV(text, jobDescription);
                          setAnalysisResult(result);
                          setIsScanned(true);
                          logActivity("Match Calculated", `Calculated ATS Match score of ${result.matchPercentage}% using Optimized CV against Target Job Description.`);
                        }, 50);
                      }}
                      className="cv-button cv-button--secondary text-[10px] py-1 px-2.5 font-bold"
                      title="Run full ATS diagnostics report"
                    >
                      <Sparkles className="w-3 h-3 text-primary-400" />
                      Test ATS Match
                    </button>
                    <button
                      onClick={handlePrintResume}
                      className="cv-button cv-button--secondary text-[10px] py-1 px-2.5"
                      title="Print using browser engine"
                    >
                      Print
                    </button>
                    <button
                      onClick={handleDownloadAsImage}
                      disabled={isExporting}
                      className="cv-button cv-button--secondary text-[10px] py-1 px-2.5"
                      title="Export as PNG image"
                    >
                      Export PNG
                    </button>
                    <button
                      onClick={handleDownloadAsPDF}
                      disabled={isExporting}
                      className="cv-button cv-button--primary text-[10px] py-1 px-2.5"
                      title="Export layout-preserved PDF"
                    >
                      {isExporting ? "..." : "Export PDF"}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-950/40 rounded-xl p-4 border border-slate-900">
                  <div className="cv-resume-sheet scale-[0.85] origin-top translate-y-[-10px] select-text" id="cv-resume-preview-sheet">
                    {renderResumeTemplate(optimizedCV)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cv-app">
      {/* HEADER NAVBAR */}
      <header className="cv-header">
        <div className="cv-header__container">
          <div className="cv-header__logo-group">
            <div className="cv-header__logo-icon">🎯</div>
            <div>
              <span className="cv-header__title">ATS Optimizer</span>
              <span className="cv-header__subtitle">Precision Screen Pass System</span>
            </div>
          </div>
          
          <nav className="cv-nav-tabs">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`cv-nav-tabs__item ${activeTab === "dashboard" ? "cv-nav-tabs__item--active" : ""}`}
            >
              <History className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("ats-scan")}
              className={`cv-nav-tabs__item ${activeTab === "ats-scan" ? "cv-nav-tabs__item--active" : ""}`}
            >
              <UploadCloud className="w-4 h-4" />
              ATS Matcher
            </button>
            <button
              onClick={() => setActiveTab("cv-optimize")}
              className={`cv-nav-tabs__item ${activeTab === "cv-optimize" ? "cv-nav-tabs__item--active" : ""}`}
            >
              <FileEdit className="w-4 h-4" />
              CV Optimizer
            </button>
            <button
              onClick={() => setActiveTab("cover-letter")}
              className={`cv-nav-tabs__item ${activeTab === "cover-letter" ? "cv-nav-tabs__item--active" : ""}`}
            >
              <Briefcase className="w-4 h-4" />
              Cover Letter
            </button>
            <button
              onClick={() => setActiveTab("linkedin")}
              className={`cv-nav-tabs__item ${activeTab === "linkedin" ? "cv-nav-tabs__item--active" : ""}`}
            >
              <Linkedin className="w-4 h-4" />
              LinkedIn Copy
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`cv-nav-tabs__item ${activeTab === "settings" ? "cv-nav-tabs__item--active" : ""}`}
            >
              <Settings className="w-4 h-4" />
              API Settings
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN CONTAINER CONTENT */}
      <main className="cv-container flex-grow">
        
        {/* ========================================================
            TAB 1: DASHBOARD / AUDIT LOG
            ======================================================== */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Analytics card 1 */}
              <div className="cv-card cv-card--interactive cv-card--highlighted">
                <div className="cv-card__body flex justify-between items-center py-2">
                  <div>
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Resumes Scanned</span>
                    <h3 className="text-4xl font-extrabold mt-1 tracking-tight">{totalScans}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
              </div>
              
              {/* Analytics card 2 */}
              <div className="cv-card cv-card--interactive">
                <div className="cv-card__body flex justify-between items-center py-2">
                  <div>
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Average Match Score</span>
                    <h3 className="text-4xl font-extrabold mt-1 tracking-tight">
                      {averageScore > 0 ? `${averageScore}%` : "—"}
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex items-center justify-center text-accent-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Analytics card 3 */}
              <div className="cv-card cv-card--interactive">
                <div className="cv-card__body flex justify-between items-center py-2">
                  <div>
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Last Computed Score</span>
                    <h3 className="text-4xl font-extrabold mt-1 tracking-tight">
                      {lastScore[0] !== "-" ? `${lastScore[0]}%` : "—"}
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-success-500/10 flex items-center justify-center text-success-450">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>

            {/* Local Registry ledger audit component */}
            <div className="cv-card">
              <div className="cv-card__header">
                <div>
                  <h2 className="cv-card__title">
                    <History className="text-primary-500 w-5 h-5" />
                    Local Activity Ledger
                  </h2>
                  <p className="cv-card__subtitle">All CV processing operations stored client-side in browser memory</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleClearAllLogs} className="cv-button cv-button--secondary text-xs py-1.5 px-3">
                    <Trash2 className="w-3.5 h-3.5" />
                    Purge History
                  </button>
                </div>
              </div>

              <div className="cv-card__body overflow-x-auto max-w-full">
                {activityLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm">No recorded events in ledger audit ledger. Start by analyzing a resume!</p>
                  </div>
                ) : (
                  <table className="cv-log-table">
                    <thead className="cv-log-table__head">
                      <tr>
                        <th className="cv-log-table__header-cell w-1/4">Timestamp</th>
                        <th className="cv-log-table__header-cell w-1/4">Action</th>
                        <th className="cv-log-table__header-cell w-2/4">Audit Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.map((log) => (
                        <tr key={log.id} className="cv-log-table__row">
                          <td className="cv-log-table__cell cv-log-table__cell--timestamp">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="cv-log-table__cell">
                            <span className={`cv-status-pill ${
                              log.action.includes("Error") || log.action.includes("Purged")
                                ? "cv-status-pill--danger" 
                                : log.action.includes("Optimized") || log.action.includes("Generated")
                                ? "cv-status-pill--success"
                                : log.action.includes("Calculated")
                                ? "cv-status-pill--warning"
                                : "cv-status-pill--neutral"
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="cv-log-table__cell text-slate-400 text-xs">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: ATS SCAN & MATCH ANALYSIS
            ======================================================== */}
        {activeTab === "ats-scan" && (
          <div className="space-y-8">
            {optimizedCV && (
              <div className="flex flex-wrap items-center gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 mb-2">
                <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Select CV version to scan:</span>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800/60">
                  <button
                    onClick={() => {
                      setCvSource("original");
                      setIsScanned(false);
                      setAnalysisResult(null);
                    }}
                    className={`text-[11px] font-bold px-4.5 py-1.5 rounded transition-colors uppercase ${
                      cvSource === "original"
                        ? "bg-primary-600 text-white shadow-md shadow-primary-500/10"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Original Uploaded CV
                  </button>
                  <button
                    onClick={() => {
                      setCvSource("optimized");
                      setIsScanned(false);
                      setAnalysisResult(null);
                    }}
                    className={`text-[11px] font-bold px-4.5 py-1.5 rounded transition-colors uppercase ${
                      cvSource === "optimized"
                        ? "bg-primary-600 text-white shadow-md shadow-primary-500/10"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Optimized CV (Form Editor)
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* File Upload card */}
              <div className="cv-card flex flex-col justify-between">
                <div>
                  <div className="cv-card__header">
                    <div>
                      <h2 className="cv-card__title">
                        <FileText className="text-primary-500 w-5 h-5" />
                        Upload Resume (PDF Only)
                      </h2>
                      <p className="cv-card__subtitle">Extract content securely in a Web Worker thread</p>
                    </div>
                  </div>

                  <div className="cv-card__body">
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`cv-dropzone ${isDragActive ? "cv-dropzone--active" : ""}`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div className="cv-dropzone__icon-container">
                        {isParsing ? (
                          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
                        ) : (
                          <UploadCloud className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      
                      {isParsing ? (
                        <div>
                          <p className="cv-dropzone__title">Extracting Resume Text...</p>
                          <p className="cv-dropzone__text mt-1 text-primary-400">
                            {parsingProgress && parsingProgress.total > 0
                              ? `Scanning page ${parsingProgress.page} of ${parsingProgress.total}...`
                              : "Working on thread allocation..."}
                          </p>
                        </div>
                      ) : cvFileName ? (
                        <div>
                          <p className="cv-dropzone__title text-success-500">
                            <Check className="inline-block w-4 h-4 mr-1" />
                            {cvFileName}
                          </p>
                          <p className="cv-dropzone__text mt-1">
                            Successfully parsed. Click to upload a different PDF resume.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="cv-dropzone__title">Drag & Drop Resume PDF</p>
                          <p className="cv-dropzone__text">
                            or click to browse local files. Extracted completely client-side.
                          </p>
                        </div>
                      )}
                    </div>

                    {parseError && (
                      <div className="bg-danger-50/10 border border-danger-500/20 text-danger-500 rounded-xl p-3 flex gap-2 items-center text-xs mt-3">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{parseError}</span>
                      </div>
                    )}
                  </div>
                </div>

                {(cvSource === "original" ? cvText : (optimizedCV ? serializeResumeData(optimizedCV) : "")) && (
                  <div className="mt-4 pt-4 border-t border-slate-800/40 text-slate-400 text-xs">
                    <span className="font-semibold block mb-1">
                      {cvSource === "original" ? "Parsed Resume Snippet" : "Optimized Resume Snippet"} (First 150 characters):
                    </span>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 font-mono text-[11px] leading-relaxed whitespace-pre-line truncate">
                      {(cvSource === "original" ? cvText : serializeResumeData(optimizedCV!)).slice(0, 150)}...
                    </div>
                  </div>
                )}
              </div>

              {/* Job description input card */}
              <div className="cv-card flex flex-col justify-between">
                <div>
                  <div className="cv-card__header">
                    <div>
                      <h2 className="cv-card__title">
                        <Briefcase className="text-primary-500 w-5 h-5" />
                        Target Job Description
                      </h2>
                      <p className="cv-card__subtitle">Paste requirements to match skills and keywords</p>
                    </div>
                  </div>

                  <div className="cv-card__body">
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the complete job description details here (skills, qualifications, expectations)..."
                      className="cv-textarea min-h-[220px]"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleCalculateMatch}
                    disabled={
                      (cvSource === "original" && !cvText) ||
                      (cvSource === "optimized" && !optimizedCV) ||
                      !jobDescription.trim()
                    }
                    className="cv-button cv-button--primary w-full sm:w-auto"
                  >
                    <Sparkles className="w-4 h-4" />
                    Calculate Match Percentage
                  </button>
                </div>
              </div>
            </div>

            {/* ATS Match analysis breakdown results visualizer */}
            {isScanned && analysisResult && (
              <div className="cv-card cv-card--highlighted border-slate-700/60">
                <div className="cv-card__header">
                  <div>
                    <h3 className="cv-card__title">ATS Scanning Report & Match Diagnostics</h3>
                    <p className="cv-card__subtitle">Calculated weighted analytics from text extraction comparison</p>
                  </div>
                </div>

                <div className="cv-card__body grid grid-cols-1 md:grid-cols-4 gap-8 items-center py-4">
                  {/* Gauge section */}
                  <div className="flex flex-col items-center justify-center md:border-r border-slate-800/80 pr-2">
                    <div className="cv-gauge">
                      <svg className="cv-gauge__svg" viewBox="0 0 100 100">
                        {/* Track circle */}
                        <circle
                          className="cv-gauge__bg-circle"
                          cx="50"
                          cy="50"
                          r="42"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        {/* Value fill */}
                        <circle
                          className="cv-gauge__fill-circle"
                          cx="50"
                          cy="50"
                          r="42"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 42}
                          strokeDashoffset={2 * Math.PI * 42 * (1 - analysisResult.matchPercentage / 100)}
                          strokeLinecap="round"
                          style={{
                            stroke: analysisResult.matchPercentage >= 75
                              ? "#22c55e" // Success
                              : analysisResult.matchPercentage >= 50
                              ? "#f59e0b" // Warning
                              : "#ef4444", // Danger
                          }}
                        />
                      </svg>
                      <div className="cv-gauge__text-container">
                        <span className="cv-gauge__value">{analysisResult.matchPercentage}%</span>
                        <span className="cv-gauge__label">Score</span>
                      </div>
                    </div>
                    
                    <span className={`mt-3 text-xs font-semibold uppercase tracking-wider ${
                      analysisResult.matchPercentage >= 75
                        ? "text-success-500"
                        : analysisResult.matchPercentage >= 50
                        ? "text-warning-500"
                        : "text-danger-500"
                    }`}>
                      {analysisResult.matchPercentage >= 75
                        ? "Strong Match Candidate"
                        : analysisResult.matchPercentage >= 50
                        ? "Fair Match (Optimize required)"
                        : "Low ATS Match Probability"}
                    </span>
                  </div>

                  {/* Summary lists */}
                  <div className="md:col-span-3 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">CV Words</span>
                        <p className="text-xl font-bold mt-1 text-slate-200">{analysisResult.statistics.cvWordCount}</p>
                      </div>
                      <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">JD Words</span>
                        <p className="text-xl font-bold mt-1 text-slate-200">{analysisResult.statistics.jdWordCount}</p>
                      </div>
                      <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Matches</span>
                        <p className="text-xl font-bold mt-1 text-success-500">{analysisResult.statistics.matchedCount}</p>
                      </div>
                      <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Missing Keywords</span>
                        <p className="text-xl font-bold mt-1 text-danger-500">{analysisResult.statistics.missingCount}</p>
                      </div>
                    </div>

                    {/* Structural Flags alert section */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-350 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-primary-500" />
                        Structural Audit Flags
                      </h4>
                      {analysisResult.structuralFlags.length === 0 ? (
                        <div className="bg-success-50/10 border border-success-500/20 text-success-500 rounded-xl p-3.5 text-xs flex gap-2 items-center">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>Structure Passed: All critical sections, contacts, and length dimensions conform to ATS parsers!</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {analysisResult.structuralFlags.map((flag) => (
                            <div
                              key={flag.id}
                              className={`border rounded-xl p-3 text-xs flex gap-3 ${
                                flag.type === "error"
                                  ? "bg-danger-50/5 border-danger-500/25 text-danger-400"
                                  : flag.type === "warning"
                                  ? "bg-warning-50/5 border-warning-500/25 text-warning-400"
                                  : "bg-slate-900/50 border-slate-800/80 text-slate-350"
                              }`}
                            >
                              {flag.type === "error" ? (
                                <XCircle className="w-4.5 h-4.5 text-danger-500 flex-shrink-0 mt-0.5" />
                              ) : flag.type === "warning" ? (
                                <AlertTriangle className="w-4.5 h-4.5 text-warning-500 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Info className="w-4.5 h-4.5 text-primary-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span className="font-bold block text-slate-100">{flag.message}</span>
                                <span className="block mt-0.5 text-slate-400">💡 {flag.fix}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Keyword Pills matching/missing section */}
                <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-6">
                  {/* Hard Skills Section */}
                  {analysisResult.hardSkills.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-350 uppercase tracking-widest mb-3">Hard Skills / Tech Stack Match</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.hardSkills.map((skill, index) => (
                          <span
                            key={`hard-${index}`}
                            className={`cv-status-pill ${
                              skill.matched ? "cv-status-pill--success" : "cv-status-pill--danger"
                            }`}
                          >
                            {skill.matched ? "✓" : "✗"} {skill.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Soft Skills Section */}
                  {analysisResult.softSkills.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-350 uppercase tracking-widest mb-3">Soft Skills / Core Competencies</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.softSkills.map((skill, index) => (
                          <span
                            key={`soft-${index}`}
                            className={`cv-status-pill ${
                              skill.matched ? "cv-status-pill--success" : "cv-status-pill--danger"
                            }`}
                          >
                            {skill.matched ? "✓" : "✗"} {skill.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Context keywords */}
                  {analysisResult.contextKeywords.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-350 uppercase tracking-widest mb-3">Context Keywords overlap</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.contextKeywords.map((skill, index) => (
                          <span
                            key={`context-${index}`}
                            className={`cv-status-pill ${
                              skill.matched ? "cv-status-pill--success" : "cv-status-pill--neutral"
                            }`}
                          >
                            {skill.matched ? "✓" : "✗"} {skill.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-4 border-t border-slate-800/80 flex justify-between items-center flex-wrap gap-4">
                  <span className="text-xs text-slate-400">Ready to boost this score? Go to the CV Optimizer or Cover Letter tab.</span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActiveTab("cv-optimize")}
                      className="cv-button cv-button--primary text-xs py-2"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      Go Optimize CV
                    </button>
                    <button
                      onClick={() => setActiveTab("cover-letter")}
                      className="cv-button cv-button--secondary text-xs py-2"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      Generate Cover Letter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: CV OPTIMIZATION ENGINE
            ======================================================== */}
        {activeTab === "cv-optimize" && renderCVOptimizeTab()}

        {/* ========================================================
            TAB 4: TARGET COVER LETTER GENERATOR
            ======================================================== */}
        {activeTab === "cover-letter" && (
          <div className="space-y-6">
            <div className="cv-card">
              <div className="cv-card__header flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <h2 className="cv-card__title">
                    <Briefcase className="text-primary-500 w-5 h-5" />
                    Target Cover Letter Generator
                  </h2>
                  <p className="cv-card__subtitle">Synthesize a tailored Cover Letter highlighting technical alignments</p>
                </div>
                
                <button
                  onClick={handleGenerateCoverLetter}
                  disabled={isGeneratingCL || !cvText || !jobDescription}
                  className="cv-button cv-button--primary text-xs w-full sm:w-auto mt-3 sm:mt-0"
                >
                  {isGeneratingCL ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generating Cover Letter...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Synthesize Cover Letter
                    </>
                  )}
                </button>
              </div>

              {clError && (
                <div className="bg-danger-50/10 border border-danger-500/20 text-danger-500 rounded-xl p-3 flex gap-2 items-center text-xs mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{clError}</span>
                </div>
              )}

              <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-5 flex flex-col min-h-[400px]">
                {coverLetter ? (
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="flex-1 w-full bg-transparent border-0 resize-none text-sm font-sans text-slate-200 focus:ring-0 focus:outline-none leading-relaxed h-[380px] overflow-y-auto whitespace-pre-wrap"
                  />
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-slate-500 py-20 text-center">
                    <Briefcase className="w-10 h-10 mb-3 text-slate-600" />
                    <p className="text-sm max-w-md">
                      {!cvText || !jobDescription
                        ? "Please upload a CV PDF and add a Job Description in the ATS Matcher tab first."
                        : "Click 'Synthesize Cover Letter' to write a tailored layout using details from your CV."}
                    </p>
                  </div>
                )}
              </div>

              {coverLetter && (
                <div className="cv-card__footer">
                  <span className="text-xs text-slate-450">Download or copy. Make sure to replace any contact bracket placeholders before applying.</span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCopyToClipboard(coverLetter, "Cover Letter")}
                      className="cv-button cv-button--secondary text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => handleDownloadFile(coverLetter, "cover_letter.txt", "Cover Letter")}
                      className="cv-button cv-button--primary text-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download plain text
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: LINKEDIN NETWORKING COPY
            ======================================================== */}
        {activeTab === "linkedin" && (
          <div className="space-y-6">
            <div className="cv-card">
              <div className="cv-card__header">
                <div>
                  <h2 className="cv-card__title">
                    <Linkedin className="text-primary-500 w-5 h-5" />
                    LinkedIn Outreach Card Creator
                  </h2>
                  <p className="cv-card__subtitle">Create an outreach note targeted at HR managers (max 200 characters)</p>
                </div>
              </div>

              <div className="cv-card__body grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                
                {/* Setup inputs column */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Target Contact Name / Role</label>
                    <input
                      type="text"
                      value={linkedinTarget}
                      onChange={(e) => setLinkedinTarget(e.target.value)}
                      placeholder="e.g. Hiring Manager, Technical Recruiter, Jane Doe"
                      className="cv-input"
                    />
                  </div>
                  
                  <button
                    onClick={handleGenerateLinkedIn}
                    disabled={isGeneratingLI || !cvText || !jobDescription}
                    className="cv-button cv-button--primary w-full text-xs"
                  >
                    {isGeneratingLI ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating copy...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate outreach message
                      </>
                    )}
                  </button>

                  {liError && (
                    <div className="bg-danger-50/10 border border-danger-500/20 text-danger-500 rounded-xl p-3 flex gap-2 items-center text-xs">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{liError}</span>
                    </div>
                  )}

                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 text-[11px] text-slate-400 leading-relaxed">
                    <Info className="inline w-3.5 h-3.5 text-primary-400 mr-1.5 align-text-bottom" />
                    <strong>Outreach Constraint:</strong> LinkedIn connection notes allow a maximum of 300 characters. Our generator caps at <strong>200 characters</strong> to ensure quick scannability for busy HR representatives.
                  </div>
                </div>

                {/* Output column */}
                <div className="md:col-span-2 space-y-3">
                  <div className="bg-slate-950/60 rounded-xl border border-slate-800/85 p-5 min-h-[140px] flex flex-col justify-between">
                    {linkedinMsg ? (
                      <textarea
                        value={linkedinMsg}
                        onChange={(e) => setLinkedinMsg(e.target.value)}
                        className="w-full bg-transparent border-0 resize-none text-sm font-sans text-slate-200 focus:ring-0 focus:outline-none leading-relaxed h-[90px] overflow-y-auto whitespace-pre-wrap"
                      />
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-slate-500 py-10 text-center">
                        <Linkedin className="w-8 h-8 mb-2 text-slate-600" />
                        <p className="text-xs">Click generate to produce your outreach message.</p>
                      </div>
                    )}
                    
                    {/* Character limit constraint bar */}
                    {linkedinMsg && (
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-900/60">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Character count</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          linkedinMsg.length <= 200 
                            ? "bg-success-50/10 text-success-500" 
                            : "bg-danger-50/10 text-danger-500 animate-pulse"
                        }`}>
                          {linkedinMsg.length} / 200 {linkedinMsg.length > 200 && "(Exceeds limit)"}
                        </span>
                      </div>
                    )}
                  </div>

                  {linkedinMsg && (
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleCopyToClipboard(linkedinMsg, "LinkedIn Outreach")}
                        className="cv-button cv-button--secondary text-xs"
                      >
                        {copiedTextType === "LinkedIn Outreach" ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-success-550" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy to Clipboard
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: API SETTINGS VIEW
            ======================================================== */}
        {activeTab === "settings" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="cv-card">
              <div className="cv-card__header">
                <div>
                  <h2 className="cv-card__title">
                    <Settings className="text-primary-500 w-5 h-5" />
                    AI Credentials Configuration
                  </h2>
                  <p className="cv-card__subtitle">Keys are stored locally in your browser and never leave your machine</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="cv-card__body space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-350 block mb-1">Google Gemini API Key</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="cv-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-350 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-450 block mt-1.5 leading-relaxed">
                    Don&apos;t have an API key? You can get a free key from the{" "}
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      Google AI Studio portal <ExternalLink className="w-2.5 h-2.5" />
                    </a>.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-350 block mb-1">Target Model selection</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="cv-input bg-[#070b13] border-slate-800"
                  >
                    {testResultList && testResultList.length > 0 ? (
                      testResultList.map((m) => (
                        <option key={m} value={m}>
                          {m} (Authorized for Key)
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Default)</option>
                        <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash Latest</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      </>
                    )}
                  </select>
                </div>

                {settingsSaved && (
                  <div className="bg-success-50/10 border border-success-500/20 text-success-500 rounded-xl p-3 flex gap-2 items-center text-xs">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>API credentials saved successfully!</span>
                  </div>
                )}

                {testErrorMsg && (
                  <div className="bg-danger-50/10 border border-danger-500/20 text-danger-500 rounded-xl p-3 flex flex-col gap-1 text-xs">
                    <div className="flex gap-2 items-center font-bold">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>API Connection Failed</span>
                    </div>
                    <p className="mt-1 text-slate-300 font-mono text-[11px] bg-slate-950/60 p-2 rounded border border-slate-900 overflow-x-auto whitespace-pre-wrap">{testErrorMsg}</p>
                    <p className="mt-2 text-slate-400">
                      💡 <strong>Common fix:</strong> If you see a warning about the <em>Generative Language API</em> being disabled in your project, click the link within the error payload text box above to enable it.
                    </p>
                  </div>
                )}

                {testResultList && (
                  <div className="bg-success-50/10 border border-success-500/20 text-success-550 rounded-xl p-3 flex flex-col gap-1 text-xs">
                    <div className="flex gap-2 items-center font-bold">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>API Connection Succeeded!</span>
                    </div>
                    <p className="mt-1 text-slate-300">
                      Your key is active and has access to <strong>{testResultList.length}</strong> Gemini model endpoints:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      {testResultList.map((m) => (
                        <span key={m} className="cv-status-pill cv-status-pill--neutral text-[10px] py-0.5 px-1.5">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-2 flex-wrap">
                  <button type="submit" className="cv-button cv-button--primary w-full sm:w-auto">
                    Save Config Credentials
                  </button>
                  <button
                    type="button"
                    onClick={handleTestAPIKey}
                    disabled={isTestingKey || !apiKey.trim()}
                    className="cv-button cv-button--secondary w-full sm:w-auto text-xs"
                  >
                    {isTestingKey ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                        Test Connection
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Privacy Card warning */}
            <div className="cv-card bg-[#0e1726]/40 border border-slate-800/40">
              <div className="cv-card__body text-xs text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-200 block mb-1 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-primary-500" />
                  Client Security Framework Notice
                </span>
                Our application is designed around zero-backend data transfer values. Your uploaded resume PDF files are read using localized canvas objects inside Web Worker background loops. The API configurations and event logs are handled through browser-bound local stores. All model calls are made as direct HTTPS requests straight to Google endpoints.
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="py-6 border-t border-slate-800/50 bg-[#070b13] mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-xs">
          <span>ATS Resume Analyzer &amp; Maker Pro • Built completely Client-Side • Powered by Google Gemini 1.5</span>
        </div>
      </footer>

      {/* Target print section container */}
      <div className="cv-print-section hidden print:block">
        {renderResumeTemplate(optimizedCV)}
      </div>
    </div>
  );
}

/**
 * Client-Side PDF Text Extractor using PDF.js Background Worker.
 * Loads the coordinator on the main thread and delegates CPU-heavy parsing
 * to the official background Web Worker.
 */

// CDN locations of stable PDF.js libraries
const PDF_JS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
const PDF_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

/**
 * Dynamically appends a script element to the document header.
 * Resolves once the script has successfully loaded.
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load script outside browser context."));
      return;
    }
    
    // If already injected, resolve immediately
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load external dependency: ${src}`));
    document.head.appendChild(script);
  });
}

export interface ParserProgress {
  page: number;
  total: number;
}

/**
 * Runs client-side text extraction on a File object.
 * Returns a promise resolving to the full text content.
 * Delegated to PDF.js background worker thread.
 */
export async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: ParserProgress) => void
): Promise<string> {
  // 1. Load the coordinator script in the main window context where 'document' is defined
  await loadScript(PDF_JS_CDN);
  
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error("PDF.js library failed to initialize on window object.");
  }

  // 2. Configure the background Web Worker URL.
  // When getDocument() is called, PDF.js will natively spawn a background Web Worker
  // using this URL, keeping all decompression and character decoding off the main thread.
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      if (!arrayBuffer) {
        reject(new Error("Failed to read PDF file buffer into memory."));
        return;
      }

      try {
        // 3. Start parsing task using the ArrayBuffer.
        // The library transfers computation tasks to the background Web Worker.
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        
        const pdf = await loadingTask.promise;
        let fullText = "";
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          
          // Extracts structural character mappings from the page
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
            
          fullText += pageText + "\n\n";
          
          if (onProgress) {
            onProgress({ page: i, total: numPages });
          }
        }

        resolve(fullText.trim());
      } catch (err: any) {
        reject(new Error(err?.message || "An error occurred during PDF text extraction."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file from disk."));
    };

    reader.readAsArrayBuffer(file);
  });
}

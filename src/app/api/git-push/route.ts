import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

const runCmd = (cmd: string, cwd: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(stdout + "\n" + stderr + "\n" + error.message);
      } else {
        resolve(stdout + "\n" + stderr);
      }
    });
  });
};

export async function GET() {
  const cwd = path.resolve(process.cwd());
  const repoUrl = "https://github.com/bill7pearl/ATSchecker.git";
  const logs: string[] = [];
  
  try {
    // Configure safe git commands
    logs.push("Initializing Git...");
    const initRes = await runCmd("git init", cwd);
    logs.push(initRes);
    
    logs.push("Configuring remote...");
    try {
      await runCmd("git remote remove origin", cwd);
    } catch (e) {}
    const remoteRes = await runCmd(`git remote add origin ${repoUrl}`, cwd);
    logs.push(remoteRes);
    
    logs.push("Adding files to index...");
    const addRes = await runCmd("git add .", cwd);
    logs.push(addRes);
    
    logs.push("Creating local commit...");
    try {
      // Set basic config if not set
      await runCmd('git config user.email "billal@example.com"', cwd);
      await runCmd('git config user.name "Billal"', cwd);
    } catch (e) {}
    
    const commitRes = await runCmd('git commit -m "Initial commit - ATS CV Analyzer & Maker Pro"', cwd);
    logs.push(commitRes);
    
    logs.push("Renaming branch to main...");
    try {
      await runCmd("git branch -M main", cwd);
    } catch (e) {}
    
    logs.push("Pushing to GitHub remote repository...");
    const pushRes = await runCmd("git push -u origin main", cwd);
    logs.push(pushRes);
    
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || err, logs });
  }
}

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp as initializeFirebaseApp } from 'firebase/app';
import { getStorage as getFirebaseStorage, ref as firebaseStorageRef, uploadString as firebaseUploadString, getDownloadURL as firebaseGetDownloadURL } from 'firebase/storage';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

// Load client config safely on server to instantiate server-side Firebase client
let firebaseConfig: any = {};
let serverStorage: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseServerApp = initializeFirebaseApp(firebaseConfig);
    serverStorage = getFirebaseStorage(firebaseServerApp);
    console.log('[Civora App] Server-side Firebase Storage successfully initialized.');
  }
} catch (err) {
  console.error('[Civora App] Failed to initialize server-side Firebase fallback:', err);
}

// Initialize Express
const app = express();
const PORT = 3000;

// Increase request payload size limit for base64 image transfers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Serve local uploads folder statically for offline fallbacks
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Initialize Google Gen AI client safely
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not defined.');
  }
  return new GoogleGenAI({ apiKey });
};

// Robust helper to perform Gemini generation with automatic failover across different models
const generateContentWithFallback = async (
  ai: any,
  params: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }
): Promise<any> => {
  const models = [
    params.preferredModel || 'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
  ];

  let lastError: any = null;
  for (const model of models) {
    try {
      console.log(`[Civora Gemini] Attempting content generation using model: "${model}"`);
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      console.log(`[Civora Gemini] Successfully completed generation using model: "${model}"`);
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[Civora Gemini] Model "${model}" failed. Reason: ${errMsg.substring(0, 150)}...`);
    }
  }
  throw lastError || new Error('All Gemini fallback models failed.');
};

// Robust helper to parse and clean potential model responses (e.g. stripping markdown tags if any)
const safeJsonParse = (text: string): any => {
  if (!text) {
    throw new Error('Model returned an empty response.');
  }
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.error('Failed to parse Gemini JSON response. Raw output:', text);
    throw new Error(`Model returned malformed JSON structure: ${err.message}`);
  }
};

// API: Server Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API: Send Email notification for issue log or status change
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, category, status, description, beforeImage, afterImage, severity, responsible_department, reportId } = req.body;

    if (!to) {
      res.status(400).json({ error: 'to parameter is required' });
      return;
    }

    console.log(`[Civora Mail] Received request to send status update email to: ${to} (Status: ${status})`);

    const attachments: any[] = [];

    const processImageAttachment = (img: string | undefined, cid: string) => {
      if (!img) return undefined;
      
      // If it's a base64 data url, parse and create a CID attachment
      if (img.startsWith('data:')) {
        const matches = img.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const base64Data = matches[2];
          attachments.push({
            filename: `${cid}.${contentType.split('/')[1] || 'png'}`,
            content: Buffer.from(base64Data, 'base64'),
            cid: cid
          });
          return `cid:${cid}`;
        }
      }
      
      // If it starts with http or https, return it as is
      if (img.startsWith('http://') || img.startsWith('https://')) {
        return img;
      }
      
      // Construct absolute URL for standard local files
      const host = req.get('host');
      const protocol = req.protocol;
      return `${protocol}://${host}${img}`;
    };

    const formattedBefore = processImageAttachment(beforeImage, 'before_photo');
    const formattedAfter = processImageAttachment(afterImage, 'after_photo');

    let statusBadgeClass = 'badge-reported';
    if (status === 'Under Review') statusBadgeClass = 'badge-review';
    if (status === 'Resolved') statusBadgeClass = 'badge-resolved';

    let severityBadgeClass = 'badge-medium';
    if (severity === 'High') severityBadgeClass = 'badge-high';
    if (severity === 'Low') severityBadgeClass = 'badge-low';

    // Build subject line
    let subject = `[Civora Update] Civic Report Status: ${status} (${category})`;
    if (status === 'Reported') {
      subject = `[Civora Citizen] Civic Report Successfully Logged: ${category}`;
    }

    // Build personalized dynamic greetings text
    let greetingsText = '';
    if (status === 'Reported') {
      greetingsText = `Thank you for filing this civic report. Your vigilance and active community participation help our municipal boards locate defects, bypass bureaucratic delays, and keep our streets safe. We have logged and dispatched this issue to the designated agency.`;
    } else if (status === 'Under Review') {
      greetingsText = `Great news! The designated board has formally accepted your report and has assigned field staff to investigate the issue. Work preparations are currently under review.`;
    } else if (status === 'Resolved') {
      greetingsText = `Success! The department has marked this issue as fully resolved. Our AI Resolution Auditor has reviewed the geotagged proof of work and validated the fix. Thank you for making our city a better place!`;
    } else {
      greetingsText = `Your report has been updated to status: "${status}". Thank you for your continued engagement in our civic ecosystem.`;
    }

    // Generate HTML Body
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #06080f;
            color: #cbd5e1;
            margin: 0;
            padding: 0;
          }
          .wrapper {
            background-color: #06080f;
            padding: 30px 15px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #0d111d;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .header {
            background: linear-gradient(135deg, #8b5cf6, #3b82f6);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.025em;
          }
          .header p {
            color: rgba(255, 255, 255, 0.8);
            margin: 8px 0 0;
            font-size: 12px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.1em;
          }
          .content {
            padding: 30px;
          }
          .greetings {
            font-size: 14px;
            line-height: 1.6;
            color: #f1f5f9;
            margin-bottom: 25px;
          }
          .card {
            background-color: rgba(255, 255, 255, 0.015);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
          }
          .meta-grid {
            width: 100%;
            border-collapse: collapse;
          }
          .meta-label {
            font-weight: 700;
            color: #94a3b8;
            font-size: 13px;
            padding: 6px 0;
            width: 140px;
            text-align: left;
          }
          .meta-value {
            color: #f1f5f9;
            font-size: 13px;
            padding: 6px 0;
            text-align: left;
          }
          .badge {
            display: inline-block;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            border-radius: 6px;
            letter-spacing: 0.05em;
          }
          .badge-reported { background-color: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
          .badge-review { background-color: rgba(34, 211, 238, 0.15); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.2); }
          .badge-resolved { background-color: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
          
          .badge-high { background-color: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
          .badge-medium { background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2); }
          .badge-low { background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.2); }

          .description-box {
            font-size: 13px;
            line-height: 1.6;
            background-color: #06080f;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.04);
            color: #cbd5e1;
            margin-top: 15px;
          }
          .images-section {
            margin-top: 25px;
            text-align: center;
          }
          .image-card {
            display: inline-block;
            width: 47%;
            margin: 0 1% 15px;
            vertical-align: top;
            text-align: left;
          }
          .image-card img {
            width: 100%;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background-color: #06080f;
            object-fit: cover;
          }
          .image-label {
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            margin-top: 5px;
            display: block;
            text-align: center;
            letter-spacing: 0.05em;
          }
          .footer {
            background-color: #0a0d16;
            padding: 25px 30px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.03);
            font-size: 11px;
            color: #64748b;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>CIVORA CITIZEN DISPATCH</h1>
              <p>MUNICIPAL ACCOUNTABILITY SYSTEM</p>
            </div>
            <div class="content">
              <div class="greetings">
                <p>Hello,</p>
                <p>${greetingsText}</p>
              </div>
              
              <div class="card">
                <table class="meta-grid">
                  <tr>
                    <td class="meta-label">Incident ID</td>
                    <td class="meta-value" style="font-family: monospace; font-size: 12px; color: #a78bfa;">${reportId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td class="meta-label">Category</td>
                    <td class="meta-value">${category || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td class="meta-label">Status</td>
                    <td class="meta-value">
                      <span class="badge ${statusBadgeClass}">${status}</span>
                    </td>
                  </tr>
                  ${severity ? `
                  <tr>
                    <td class="meta-label">Severity Level</td>
                    <td class="meta-value">
                      <span class="badge ${severityBadgeClass}">${severity}</span>
                    </td>
                  </tr>` : ''}
                  ${responsible_department ? `
                  <tr>
                    <td class="meta-label">Dispatched To</td>
                    <td class="meta-value" style="font-weight: bold; color: #ffffff;">${responsible_department}</td>
                  </tr>` : ''}
                </table>

                ${description ? `
                <div class="description-box">
                  <strong style="display: block; font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.05em;">Incident Report Analysis & Formal Complaint:</strong>
                  ${description}
                </div>` : ''}
              </div>

              ${(status === 'Resolved' && (formattedBefore || formattedAfter)) ? `
              <div class="images-section">
                ${formattedBefore ? `
                <div class="image-card">
                  <img src="${formattedBefore}" alt="Before Photo">
                  <span class="image-label">BEFORE PHOTO</span>
                </div>` : ''}
                ${formattedAfter ? `
                <div class="image-card">
                  <img src="${formattedAfter}" alt="After Photo">
                  <span class="image-label">AFTER PHOTO</span>
                </div>` : ''}
              </div>` : ''}
            </div>
            <div class="footer">
              <p>This is an automated notification from the <strong>Civora Resolution Platform</strong>.</p>
              <p>Strengthening democratic municipal workflow through real-time feedback and AI accountability audits.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Initialize transporter and send mail with a fail-safe simulated fallback
    let mailSent = false;
    let messageId = '';
    let previewUrl: string | boolean | undefined = undefined;
    let sendErrorMsg = '';

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromEnv = process.env.SMTP_FROM;

    if (host && user && pass) {
      try {
        console.log('[Civora Mail] Attempting custom SMTP delivery...');
        const transporter = nodemailer.createTransport({
          host,
          port: parseInt(port || '587'),
          secure: port === '465',
          auth: { user, pass }
        });

        const fromName = "Civora Citizen Dispatch";
        let fromEmail = fromEnv || user;
        if (!fromEmail || !fromEmail.includes('@')) {
          if (host.includes('resend')) {
            fromEmail = 'onboarding@resend.dev';
          } else {
            fromEmail = 'noreply@civora.local';
          }
        }

        console.log(`[Civora Mail] Using SMTP Sender Address: ${fromEmail}`);

        const mailOptions: any = {
          from: `"${fromName}" <${fromEmail}>`,
          to,
          subject,
          html: htmlContent
        };

        if (attachments.length > 0) {
          mailOptions.attachments = attachments;
        }

        const info = await transporter.sendMail(mailOptions);
        messageId = info.messageId;
        mailSent = true;
        console.log('[Civora Mail] Email successfully sent to production recipient! Message ID:', info.messageId);
      } catch (err: any) {
        console.error('[Civora Mail] Custom SMTP delivery failed, falling back:', err.message || err);
        sendErrorMsg = err.message || String(err);
      }
    } else {
      // Try Ethereal if possible, but catch errors instantly if external networking is blocked
      try {
        console.log('[Civora Mail] No custom SMTP credentials. Attempting temporary Ethereal SMTP account creation...');
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });

        const fromName = "Civora Citizen Dispatch";
        const fromEmail = "noreply@civora.local";
        const mailOptions: any = {
          from: `"${fromName}" <${fromEmail}>`,
          to,
          subject,
          html: htmlContent
        };

        if (attachments.length > 0) {
          mailOptions.attachments = attachments;
        }

        const info = await transporter.sendMail(mailOptions);
        messageId = info.messageId;
        previewUrl = nodemailer.getTestMessageUrl(info);
        mailSent = true;
        if (previewUrl) {
          console.log('[Civora Mail] 📬 Test Email successfully sent! View live rendering at:', previewUrl);
        }
      } catch (err: any) {
        console.warn('[Civora Mail] Ethereal SMTP failed or blocked by sandbox network. Switching to simulated mode:', err.message || err);
        sendErrorMsg = err.message || String(err);
      }
    }

    // Fallback: If mail was not sent successfully, run simulated delivery
    if (!mailSent) {
      console.log('\n=================== 📨 CIVORA SIMULATED EMAIL DISPATCH ===================');
      console.log(`TO:      ${to}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`STATUS:  ${status}`);
      console.log(`DEPT:    ${responsible_department || 'N/A'}`);
      console.log(`DETAILS: ${description ? description.substring(0, 150) + '...' : 'None'}`);
      console.log('--------------------------------------------------------------------------');
      console.log('[SIMULATION NOTE] Outbound SMTP connection was restricted or unconfigured.');
      console.log('The above notification was successfully simulated and logged to console.');
      console.log('==========================================================================\n');
      
      messageId = `sim_${Math.random().toString(36).substring(2, 12)}`;
    }

    res.json({
      success: true,
      simulated: !mailSent,
      messageId,
      previewUrl: previewUrl || undefined,
      errorDetails: sendErrorMsg || undefined
    });

  } catch (error: any) {
    console.error('[Civora Mail] Unexpected error in mail dispatch endpoint:', error);
    res.status(500).json({
      error: 'Failed to process email notification',
      details: error.message || error
    });
  }
});

// API: Analyze Civic Issue (Classification, Severity, Department, Formal Complaint Draft)
app.post('/api/analyze-issue', async (req, res) => {
  try {
    const { imageBase64, mimeType, userNotesByVoiceOrText } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 parameter is required' });
      return;
    }

    const ai = getGeminiClient();
    
    // Clean up the base64 string if it contains the metadata prefix
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanMimeType = mimeType || 'image/jpeg';

    const prompt = `
      You are an expert citizen service dispatcher system called "Civora AI". 
      Your task is to analyze the provided image of a city civic/municipal issue (which is reported by a resident) 
      and combine it with their raw notes or transcribed voice notes: "${userNotesByVoiceOrText || '(No additional notes provided)'}".

      Please classify the report and return a SINGLE JSON object conforming STRICTLY to the following typescript schema rules:
      - category: One of the string literals: "Pothole", "Streetlight", "Garbage/Waste", "Water Leakage", "Damaged Public Property", "Other"
      - severity: One of the string literals: "Low", "Medium", "High"
      - severity_reasoning: List 1-2 rapid sentences explaining why this severity was assigned.
      - responsible_department: Select the most appropriate public department based on this category map:
        * Pothole -> "Municipal Corporation"
        * Damaged Public Property -> "Municipal Corporation"
        * Streetlight -> "Electricity Board"
        * Garbage/Waste -> "Sanitation Department"
        * Water Leakage -> "Water Board"
        * Other -> "Municipal Corporation" (or appropriate department in text)
      - formal_complaint_text: A beautifully formatted, formal, articulate, and polite email-like formal complaint paragraph addressed to the responsible department. Include specific visual descriptions noticed in the image, describe the safety hazards, and formally request corrective action. Do NOT use placeholder text.

      Ensure the output is valid JSON and contains only the specified fields with no extra formatting.
    `;

    // Modern SDK structured generation call with failover
    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: cleanMimeType,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            category: {
              type: 'STRING',
              enum: ['Pothole', 'Streetlight', 'Garbage/Waste', 'Water Leakage', 'Damaged Public Property', 'Other'],
            },
            severity: {
              type: 'STRING',
              enum: ['Low', 'Medium', 'High'],
            },
            severity_reasoning: {
              type: 'STRING',
            },
            responsible_department: {
              type: 'STRING',
              enum: ['Municipal Corporation', 'Electricity Board', 'Sanitation Department', 'Water Board', 'Other'],
            },
            formal_complaint_text: {
              type: 'STRING',
            }
          },
          required: ['category', 'severity', 'severity_reasoning', 'responsible_department', 'formal_complaint_text'],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('Empty response received from Gemini model');
    }

    const parsedJson = safeJsonParse(resultText);
    res.json(parsedJson);

  } catch (error: any) {
    console.error('Error analyzing civic issue:', error);
    res.status(500).json({ 
      error: 'Failed to analyze civic issue', 
      details: error.message || error 
    });
  }
});

// API: Duplicate Detection Analyzer
app.post('/api/check-duplicate', async (req, res) => {
  try {
    const { newReportDetails, existingReports } = req.body;

    console.log('\n========================================');
    console.log('[Civora API] /api/check-duplicate called!');
    console.log(`[Civora API] New Issue Category: "${newReportDetails?.category}"`);
    console.log(`[Civora API] New Description: "${newReportDetails?.formal_complaint_text?.substring(0, 80)}..."`);
    console.log(`[Civora API] New User Notes: "${newReportDetails?.userNotes || 'None'}"`);
    console.log(`[Civora API] Number of candidates to evaluate within 110m radius: ${existingReports?.length || 0}`);

    if (!newReportDetails || !existingReports || !Array.isArray(existingReports) || existingReports.length === 0) {
      console.log('[Civora API] Skipped comparison: No active reports of same category exist nearby.');
      console.log('========================================\n');
      res.json({ isDuplicate: false, confidence: 0, reasoning: 'No existing reports in immediate vicinity to match.' });
      return;
    }

    // Print details of candidates for debugging ease
    existingReports.forEach((r: any, i: number) => {
      console.log(`  -> Candidate #${i + 1}: ID: "${r.id}" | Status: "${r.status}" | Desc: "${r.formal_complaint_text?.substring(0, 60)}..."`);
    });

    const ai = getGeminiClient();

    const prompt = `
      You are the "Civora Civic Auditor" bot. Your task is to analyze details of a newly reported civic issue and compare it against the list of near-by existing active reports in the same visual area.
      We want to prevent double-logging of the exact same real-world physical asset defect (e.g. the exact same pothole, the exact same broken street light beam, the exact same pile of garbage bags at the corner).

      --- NEW REPORT INPUT DETAILS ---
      * Category: ${newReportDetails.category}
      * Description: ${newReportDetails.formal_complaint_text}
      * Citizen raw notes: ${newReportDetails.userNotes || 'None'}
      
      --- LIST OF NEARBY REPORTS TO COMPARE ---
      ${existingReports.map((r: any, idx: number) => `
      - REPORT #${idx + 1} (Public ID: ${r.id})
        * Category: ${r.category}
        * Formal Details: ${r.formal_complaint_text}
        * Notes: ${r.userNotes || 'None'}
      `).join('\n')}

      Determine if any of the existing active reports (REPORT #1, #2, etc.) represent the EXACT SAME physical real-world problem as the new report.
      Provide your response in a single JSON object with the following fields:
      - isDuplicate: boolean (true if there's a highly likely match (confidence > 75%), false otherwise)
      - confidence: number (from 0 to 100, representing matching certainty)
      - reasoning: string (provide a clear, direct, public-friendly explanation in 1-2 sentences explaining why they look like duplicates or why they represent different situations)
      - matchedReportId: string (if duplicate, specify the firebase ID of the existing matched report. Use its actual ID e.g., "abc123yz", not its list numbering index. If no duplicate, write empty string)

      Respond strictly in JSON.
    `;

    console.log('[Civora API] Prompting Gemini 2.5 Flash for duplicate screening...');
    
    let response: any;
    let attempts = 3; // 1 initial attempt + 2 retries
    let lastError: any = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Civora API] Retrying Gemini content generation... Attempt ${attempt}/${attempts}`);
        }
        response = await generateContentWithFallback(ai, {
          preferredModel: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                isDuplicate: { type: 'BOOLEAN' },
                confidence: { type: 'INTEGER' },
                reasoning: { type: 'STRING' },
                matchedReportId: { type: 'STRING' }
              },
              required: ['isDuplicate', 'confidence', 'reasoning', 'matchedReportId']
            }
          }
        });
        // Success, exit the loop!
        break;
      } catch (error: any) {
        lastError = error;
        const errorMessage = String(error?.message || '');
        const errorStack = String(error?.stack || '');
        const errorStatus = error?.status || error?.statusCode || 0;
        
        // Match 503, UNAVAILABLE, overload, capacity, rate limits or resource exhaustion
        const isTransient = 
          errorStatus === 503 ||
          errorMessage.includes('503') || 
          errorMessage.toUpperCase().includes('UNAVAILABLE') || 
          errorMessage.toLowerCase().includes('overloaded') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('resource_exhausted') ||
          errorStack.includes('503') ||
          errorStack.toUpperCase().includes('UNAVAILABLE');

        if (isTransient && attempt < attempts) {
          const delayMs = attempt * 1000; // 1s then 2s
          console.warn(`[Civora API] Gemini transient error detected (Code: ${errorStatus}, msg: "${errorMessage}"). Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          // Re-throw if not transient or if we ran out of attempts
          console.error(`[Civora API] Gemini generation failed permanently on attempt ${attempt}/${attempts}. Error:`, error);
          throw error;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Gemini API returned no response after maximum retries.');
    }

    const responseText = response.text || '{}';
    console.log('[Civora API] Gemini response received raw:\n', responseText);

    const parsedJson = safeJsonParse(responseText);
    console.log('[Civora API] Parsed Verdict outcome:', parsedJson);
    console.log('========================================\n');

    res.json(parsedJson);

  } catch (error: any) {
    console.error('Error during duplicate matching:', error);
    res.status(500).json({ error: 'Failed to verify potential duplicates', details: error.message || error });
  }
});

// API: Weekly Trends plain English paragraph generator
app.post('/api/generate-trend', async (req, res) => {
  try {
    const { reports } = req.body;

    console.log('\n========================================');
    console.log('[Civora API] /api/generate-trend called!');
    console.log(`[Civora API] Received ${reports?.length || 0} reports for aggregation.`);

    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      console.log('[Civora API] No active reports found in last 7 days payload. Returning empty/clean streets summary.');
      console.log('========================================\n');
      res.json({ 
        summary: 'No reports have been filed in the last 7 days. Our streets are looking clean and well-maintained! Keep up the great civic spirit.',
        forecast: 'Prediction unavailable. Check back in a moment.'
      });
      return;
    }

    const ai = getGeminiClient();

    // Map reports safely to bypass any nested coordinate .toFixed failures
    const formattedReportsList = reports.map((r: any, idx: number) => {
      const category = r.category || 'Unknown/General';
      const severity = r.severity || 'Medium';
      
      let latStr = 'N/A';
      let lngStr = 'N/A';
      
      if (r.location) {
        const parsedLat = Number(r.location.lat);
        const parsedLng = Number(r.location.lng);
        if (!isNaN(parsedLat)) latStr = parsedLat.toFixed(4);
        if (!isNaN(parsedLng)) lngStr = parsedLng.toFixed(4);
      }
      
      return `- [Report #${idx + 1}] Category: "${category}" at coordinates (${latStr}, ${lngStr}) with "${severity}" severity.`;
    }).join('\n');

    // Aggregate metrics for specific forecast prompt
    const categoryCounts: Record<string, number> = {};
    const hotspots: string[] = [];
    reports.forEach((r: any) => {
      const cat = r.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      if (r.location) {
        const parsedLat = Number(r.location.lat);
        const parsedLng = Number(r.location.lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          hotspots.push(`(${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)})`);
        }
      }
    });

    const countsString = Object.entries(categoryCounts).map(([cat, count]) => `${count} ${cat}`).join(', ');
    const hotspotsString = hotspots.length > 0 ? hotspots.slice(0, 3).join(' and ') : 'N/A';
    const aggregatedMetrics = `${countsString || '0 reports'}, hotspots at coordinates ${hotspotsString}`;

    console.log('[Civora API] Formatted items for Gemini prompt:\n', formattedReportsList);

    const prompt = `
      You are the "Civora Civic Intelligence System". Analyze the following civic issue reports from the last 7 days.
      
      --- RAW REPORTS LOG ---
      ${formattedReportsList}

      You must generate a response in valid JSON conforming to the requested schema containing two properties:
      1. "summary": A short, highly professional, encouraging, and informative plain-English paragraph summary (maximum of 3 or 4 engaging sentences) analyzing the community issue reports logged in the last 7 days. Briefly summarize the trends, identifying which categories are most active, and point out any apparent problem hotspots (group by general location bins/areas). Do NOT output markdown charts, lists, or tables.
      
      2. "forecast": Generate a predictive forecast based on this prompt:
         "Based on the civic issues reported in the last 7 days:
         [${aggregatedMetrics}]
         
         Predict: What types of issues should the municipality expect next week? Which geographic areas are likely to see more reports? What resources should be prioritized?
         
         Respond in 2-3 sentences, professional and actionable."
    `;

    console.log('[Civora API] Prompting Gemini 2.5 Flash for Weekly Summary & Forecast generation...');
    
    let response: any;
    let attempts = 3; // 1 initial + 2 retries
    let lastError: any = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Civora API] Retrying trend generation... Attempt ${attempt}/${attempts}`);
        }
        
        response = await generateContentWithFallback(ai, {
          preferredModel: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                summary: { type: 'STRING' },
                forecast: { type: 'STRING' }
              },
              required: ['summary', 'forecast']
            }
          }
        });
        
        break; // break loop on success!
      } catch (error: any) {
        lastError = error;
        const errorMessage = String(error?.message || '');
        const errorStack = String(error?.stack || '');
        const errorStatus = error?.status || error?.statusCode || 0;

        const isTransient = 
          errorStatus === 503 ||
          errorMessage.includes('503') || 
          errorMessage.toUpperCase().includes('UNAVAILABLE') || 
          errorMessage.toLowerCase().includes('overloaded') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('resource_exhausted') ||
          errorStack.includes('503') ||
          errorStack.toUpperCase().includes('UNAVAILABLE');

        if (isTransient && attempt < attempts) {
          const delayMs = attempt * 1000;
          console.warn(`[Civora API] Gemini transient error in trends (Code: ${errorStatus}, msg: "${errorMessage}"). Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          console.error(`[Civora API] Gemini trends generation failed permanently on attempt ${attempt}/${attempts}. Error:`, error);
          throw error;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Gemini API returned no content for trends summary.');
    }

    const responseText = response.text || '{}';
    console.log('[Civora API] Gemini response received raw:\n', responseText);

    const parsedJson = safeJsonParse(responseText);
    res.json(parsedJson);

  } catch (error: any) {
    console.error('[Civora API] Error generating trends:', error);
    res.status(500).json({ error: 'Failed to generate weekly trends summary text', details: error.message || error });
  }
});

// Helper to convert an image source (URL or base64 data_url) to Gemini inlineData format
async function getImagePart(imageStr: string) {
  try {
    if (imageStr.startsWith('http://') || imageStr.startsWith('https://')) {
      console.log(`[Civora API] Fetching external image URL for Gemini processing: ${imageStr.substring(0, 80)}...`);
      const res = await fetch(imageStr);
      if (!res.ok) {
        throw new Error(`Failed to download image from URL. Status: ${res.status}`);
      }
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      let mimeType = 'image/jpeg';
      const contentType = res.headers.get('content-type');
      if (contentType) mimeType = contentType;
      return {
        inlineData: {
          data: base64,
          mimeType
        }
      };
    } else {
      const base64Data = imageStr.replace(/^data:image\/\w+;base64,/, '');
      const mimeMatch = imageStr.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      return {
        inlineData: {
          data: base64Data,
          mimeType
        }
      };
    }
  } catch (err: any) {
    console.error('[Civora API] Error converting image to Gemini parts:', err);
    throw new Error(`Failed to parse image input: ${err.message}`);
  }
}

// API: Verify issue resolution by comparing before vs after photographs with Gemini
app.post('/api/verify-resolution', async (req, res) => {
  try {
    const { beforeImage, afterImage, category, gpsMetadata } = req.body;

    if (!beforeImage) {
      res.status(400).json({ error: 'beforeImage parameter is required.' });
      return;
    }
    if (!afterImage) {
      res.status(400).json({ error: 'afterImage parameter is required.' });
      return;
    }

    const ai = getGeminiClient();

    console.log('[Civora API] Preparing image parts for resolution validation...');
    const beforePart = await getImagePart(beforeImage);
    const afterPart = await getImagePart(afterImage);

    let gpsPromptPart = '';
    if (gpsMetadata) {
      const { distanceMeters, beforeCoords, afterCoords } = gpsMetadata;
      gpsPromptPart = `
      GEOTAG SECURITY AUDIT METADATA:
      - Incident reported coordinates: [Latitude: ${beforeCoords?.[0]?.toFixed(6)}, Longitude: ${beforeCoords?.[1]?.toFixed(6)}]
      - Resolution photo captured coordinates: [Latitude: ${afterCoords?.[0]?.toFixed(6)}, Longitude: ${afterCoords?.[1]?.toFixed(6)}]
      - Calculated geographical distance between capture spots: ${distanceMeters?.toFixed(1)} meters.

      Use this metadata to verify if the operator is physically present at the same scene. If the distance is very high (e.g. over 150 meters) and the background doesn't match, you should be extremely skeptical and verify whether the repair is authentic or flagged as unresolved/invalid location.
      `;
    }

    const prompt = `
      You are the "Civora Civic Resolution Auditor". Your task is to perform visual and geographical validation of civic repair works by comparing two images:
      1. The BEFORE photo (showing a logged civic/municipal defect of category: "${category || 'Other'}").
      2. The AFTER photo (showing the exact same physical location/defect, purportedly repaired).

      ${gpsPromptPart}

      Carefully compare the two images and review any geotag metadata:
      - Has the civic issue been successfully repaired/resolved?
      - Look at the location markers, background buildings, street surfaces, trees, poles, or fences to ensure it's the same physical spot.
      - Check if the defect (e.g. pothole filled, garbage removed, streetlight glowing/fixed, water leak stopped) is indeed corrected.

      Provide your response in a single JSON object conforming strictly to this typescript schema:
      - verified: One of the string literals: "verified" (if successfully repaired/fixed) or "unresolved" (if still broken, not fixed, or the image doesn't show a repair/shows a different spot)
      - confidence: A percentage integer between 0 and 100 representing your assessment confidence.
      - explanation: A clear, professional, public-facing single-sentence explanation (maximum of 2 sentences) describing what you observed and why you reached this verdict. Include a mention of the geotag location verification if relevant.

      Respond strictly in JSON format. Do not include markdown wraps.
    `;

    console.log('[Civora API] Prompting Gemini for before vs after resolution verification...');

    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.5-flash',
      contents: [
        { text: "BEFORE photo showing reported issue:" },
        beforePart,
        { text: "AFTER photo showing claimed resolution:" },
        afterPart,
        { text: prompt }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            verified: {
              type: 'STRING',
              enum: ['verified', 'unresolved']
            },
            confidence: {
              type: 'INTEGER'
            },
            explanation: {
              type: 'STRING'
            }
          },
          required: ['verified', 'confidence', 'explanation']
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('Empty response received from resolution validation model.');
    }

    const parsedJson = safeJsonParse(resultText);
    console.log('[Civora API] Resolution verification parsed successfully:', parsedJson);
    res.json(parsedJson);

  } catch (error: any) {
    console.error('[Civora API] Error in verify-resolution endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to verify resolution', 
      details: error.message || error 
    });
  }
});

// API: Secure upload image from base64 via server to bypass browser storage CORS constraints
app.post('/api/upload-image', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 parameter is required' });
      return;
    }

    const uniqueId = Math.random().toString(36).substring(2, 10);

    // Try serverStorage first if configured
    if (serverStorage) {
      try {
        const fileName = `reports/photo_${uniqueId}.jpg`;
        const storageRef = firebaseStorageRef(serverStorage, fileName);
        
        console.log('[Civora API] Proxying image upload to firebase storage target:', fileName);
        const uploadSnapshot = await firebaseUploadString(storageRef, imageBase64, 'data_url');
        const downloadUrl = await firebaseGetDownloadURL(uploadSnapshot.ref);
        
        res.json({ downloadUrl });
        return;
      } catch (storageErr: any) {
        console.warn('[Civora API] Firebase Storage upload failed, falling back to local file storage:', storageErr.message || storageErr);
      }
    }

    // Local file fallback
    console.log('[Civora API] Using local disk fallback for image storage.');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `photo_${uniqueId}.jpg`;
    const filePath = path.join(uploadsDir, fileName);

    // Clean up the base64 string if it contains metadata prefix
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    // Return the URL matching the static directory server endpoint
    res.json({ downloadUrl: `/uploads/${fileName}` });
  } catch (err: any) {
    console.error('Server-side upload failed completely:', err);
    res.status(500).json({ error: 'Server-side upload failed', details: err.message || err });
  }
});

// Start the Express + Vite server
async function bootServer() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting server in DEVELOPMENT mode with Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting server in PRODUCTION mode, serving static built files...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Civora App] Server successfully booted. Listening on port ${PORT}`);
  });
}

bootServer().catch((err) => {
  console.error('Failed to boot fullstack server:', err);
});

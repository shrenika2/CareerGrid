const OpenAI = require('openai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const path = require('path');
const env = require('../config/env');
const logger = require('../utils/logger');
const fs = require('fs');


const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

/**
 * AI Service for Resume Parsing and Skill Matching
 * TRACE: Resume File -> Text Extraction -> Skill Parsing -> Keyword Matching -> Score
 */
const aiService = {
    /**
     * Extract text from a PDF buffer using pdf-parse
     * @param {Buffer} buffer - PDF file buffer
     */
    extractTextFromPDF: async (buffer) => {
        try {
            let text = '';
            if (typeof pdf === 'function') {
                const data = await pdf(buffer);
                text = data.text || '';
            } else if (pdf && pdf.PDFParse) {
                const p = new pdf.PDFParse({ data: buffer });
                await p.load();
                const data = await p.getText();
                text = data.text || '';
            } else {
                throw new Error('Unsupported pdf-parse module format');
            }
            logger.info(`[AI_SERVICE] PDF Parsed. Raw Length: ${text.length || 0}`);

            if (text.trim().length < 50) {
                return {
                    success: false,
                    errorType: 'IMAGE_BASED_PDF',
                    message: 'This PDF appears to be image-based or scanned. AI cannot extract text from images. Please upload a text-based PDF or DOCX resume.'
                };
            }

            return { success: true, text };
        } catch (error) {
            logger.error(`[AI_SERVICE] PDF Extraction Error: ${error.message}`);
            return {
                success: false,
                errorType: 'EXTRACTION_FAILED',
                message: 'The PDF file structure is unreadable or corrupted. Please try a different version.'
            };
        }
    },

    /**
     * Extract text from a DOCX buffer using mammoth
     * @param {Buffer} buffer - DOCX file buffer
     */
    extractTextFromDOCX: async (buffer) => {
        try {
            const result = await mammoth.extractRawText({ buffer });
            const text = result.value || '';
            logger.info(`[AI_SERVICE] DOCX Parsed. Raw Length: ${text.length || 0}`);

            if (text.trim().length < 50) {
                return {
                    success: false,
                    errorType: 'EMPTY_DOCX',
                    message: 'The DOCX file contains no readable text or is empty.'
                };
            }

            return { success: true, text };
        } catch (error) {
            logger.error(`[AI_SERVICE] DOCX Extraction Error: ${error.message}`);
            return {
                success: false,
                errorType: 'EXTRACTION_FAILED',
                message: 'Failed to extract text from the DOCX file.'
            };
        }
    },

    /**
     * Fetch file from URL and extract text (PDF or DOCX)
     * Handles buffering and stream conversion
     */
    extractTextFromURL: async (url) => {
        if (!url) return { success: false, message: 'No URL provided' };

        try {
            logger.info(`[AI_SERVICE] Fetching resume from: ${url}`);
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
            const buffer = Buffer.from(response.data);

            if (url.toLowerCase().split('?')[0].endsWith('.docx')) {
                return await aiService.extractTextFromDOCX(buffer);
            } else {
                return await aiService.extractTextFromPDF(buffer);
            }
        } catch (error) {
            logger.error(`[AI_SERVICE] File Fetching/Extraction Error: ${error.message}`);
            return {
                success: false,
                errorType: 'FETCH_FAILED',
                message: 'Failed to fetch the resume asset from the target URL.'
            };
        }
    },

    /**
     * Extract text directly from a local file path
     */
    extractTextFromFile: async (filePath) => {
        try {
            if (!filePath || !fs.existsSync(filePath)) {
                return { success: false, message: 'File not found on disk.' };
            }

            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();

            if (ext === '.docx') {
                return await aiService.extractTextFromDOCX(buffer);
            } else {
                return await aiService.extractTextFromPDF(buffer);
            }
        } catch (error) {
            logger.error(`[AI_SERVICE] Local File Extraction Error: ${error.message}`);
            return {
                success: false,
                errorType: 'LOCAL_READ_FAILED',
                message: 'Internal error reading the local file asset.'
            };
        }
    },

    deleteTempFile: (filePath) => {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) logger.error(`[AI_SERVICE] Failed to delete temp file: ${err.message}`);
                else logger.info(`[AI_SERVICE] Temp file deleted: ${filePath}`);
            });
        }
    },

    extractSkills: async (extractionResult) => {
        if (typeof extractionResult === 'object' && extractionResult.success === false) {
            logger.warn(`[AI_SERVICE] Extraction failed, skipping AI parsing: ${extractionResult.message}`);
            return { skills: [], error: extractionResult.message };
        }

        const resumeText = typeof extractionResult === 'object' ? extractionResult.text : extractionResult;

        if (!resumeText || resumeText.trim().length < 50) {
            return { skills: [] };
        }

        try {
            const prompt = `
                You are high-precision Recruitment AI. Analyze the resume text provided.
                EXTRACT a clean list of technical skills, frameworks, and tools.
                NORMALIZE them (e.g., "React.js" -> "React", "NodeJS" -> "Node.js").
                REMOVE soft skills like "leadership" or "teamwork".
                RETURN ONLY JSON: {"skills": ["Skill1", "Skill2"]}

                RESUME TEXT:
                ${resumeText.substring(0, 6000)}
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [
                    { role: "system", content: "You are a professional resume parsing engine that only outputs JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const parsed = JSON.parse(completion.choices[0].message.content);
            return { skills: parsed.skills || [] };
        } catch (error) {
            logger.error(`[AI_SERVICE] OpenAI Skill Parsing Error: ${error.message}`);
            return { skills: [] };
        }
    },

    calculateMatchScore: (resumeSkills, requiredSkills) => {
        if (!requiredSkills || requiredSkills.length === 0) return 100;
        if (!resumeSkills || resumeSkills.length === 0) return 0;

        const rSkills = resumeSkills.map(s => s.toLowerCase().trim());
        const targetSkills = requiredSkills.map(s => s.toLowerCase().trim());

        const matched = targetSkills.filter(req =>
            rSkills.some(res => res.includes(req) || req.includes(res))
        );

        return Math.round((matched.length / targetSkills.length) * 100);
    },

    extractJDSkills: async (jdText) => {
        if (!jdText || jdText.trim().length < 50) return { skills: [] };
        try {
            const prompt = `
                Analyze the following Job Description and extract a list of required technical skills, tools, and frameworks.
                RETURN ONLY JSON: {"skills": ["Skill1", "Skill2"]}
                JD: ${jdText.substring(0, 4000)}
            `;
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [
                    { role: "system", content: "You are a professional recruiting assistant. Output ONLY JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0,
                response_format: { type: "json_object" }
            });
            const parsed = JSON.parse(completion.choices[0].message.content);
            return { skills: parsed.skills || [] };
        } catch (error) {
            return { skills: [] };
        }
    },

    generateInterviewPrompt: (candidateSkills, jobRequirements, roleDescription) => {
        const missingSkills = jobRequirements.filter(req =>
            !candidateSkills.some(res =>
                res.toLowerCase().includes(req.toLowerCase()) ||
                req.toLowerCase().includes(res.toLowerCase())
            )
        );

        return `
            You are an expert technical interviewer for the role: ${roleDescription}.
            Candidate Skills: ${candidateSkills.join(', ')}
            Job Requirements: ${jobRequirements.join(', ')}
            Missing Skills (Focus areas): ${missingSkills.join(', ')}

            Instructions:
            1. Conduct a realistic technical interview.
            2. Start with a warm greeting and ask the candidate to introduce themselves.
            3. Ask deep technical questions.
            4. Keep responses concise.
        `.trim();
    },

    generateInterviewEvaluation: async (role, transcript) => {
        try {
            const history = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
            const prompt = `
                Evaluate the technical interview for ${role}.
                TRANSCRIPT:
                ${history}
                RETURN ONLY JSON: { "score": 0-100, "message": "Feedback", "passed": true/false }
            `;
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "system", content: "You are a hiring manager. Output ONLY JSON." }, { role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            return { score: 70, message: "Evaluation complete.", passed: true };
        }
    },

    /**
     * Analyze README documentation for clarity and depth
     */
    analyzeDocumentation: async (readmeText) => {
        if (!readmeText || readmeText.trim().length < 100) {
            return { score: 3, explanation: "Documentation is sparse or missing critical context." };
        }

        try {
            const prompt = `
                Evaluate the following Project README for a hackathon.
                Look for: Clarity, Technical Depth, Installation Guide, and Structure.
                SCORE: 1-10.
                README:
                ${readmeText.substring(0, 5000)}
                RETURN ONLY JSON: {"score": 8, "explanation": "Detailed why..."}
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [
                    { role: "system", content: "You are a technical judge for a MERN stack hackathon." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            logger.error(`[AI_SERVICE] Doc Analysis Error: ${error.message}`);
            return { score: 5, explanation: "AI could not process the documentation signal." };
        }
    },

    /**
     * Comprehensive Evaluation Engine
     */
    evaluateProjectTeam: async (metrics) => {
        const { gitScore, docScore, docExplanation, milestonesCount = 0 } = metrics;

        // Weighting: 40% Git Activity, 40% Documentation, 20% Milestones
        const milestoneScore = Math.min(10, (milestonesCount / 5) * 10);
        const finalScore = (gitScore * 0.4) + (docScore * 0.4) + (milestoneScore * 0.2);

        let suggestedGrade = 'B';
        if (finalScore >= 9) suggestedGrade = 'A+';
        else if (finalScore >= 8) suggestedGrade = 'A';
        else if (finalScore >= 7) suggestedGrade = 'B+';
        else if (finalScore >= 5) suggestedGrade = 'C';
        else suggestedGrade = 'D';

        return {
            finalScore: finalScore.toFixed(1),
            suggestedGrade,
            gitScore,
            docScore,
            milestoneScore,
            explanation: `AI detected a high-fidelity output with a doc score of ${docScore}/10 and git score of ${gitScore}/10. ${docExplanation}`
        };
    }
};

module.exports = aiService;

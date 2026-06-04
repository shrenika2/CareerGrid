const { ChatOllama } = require('@langchain/ollama');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const OpenAI = require('openai');

/**
 * LLMService handles the interaction with the local Ollama instance.
 * It uses LangChain to manage prompts and streaming responses.
 */
class LLMService {
    constructor() {
        // Initialize the model with local Ollama settings
        // Defaulting to Mistral as per the original requirement
        this.model = new ChatOllama({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
            model: process.env.OLLAMA_MODEL || "mistral",
            temperature: 0.1, // Lower temperature for more focused answers
        });

        this.systemPrompt = `You are a helpful and knowledgeable AI assistant for a Student Internship Portal.
Your name is "Saarthi". You exist to help students navigate their internship search, resume building, and interview preparation.

Guidelines:
1. **Be encouraging and professional.** Your tone should be supportive but concise.
2. **Strictly adhere to facts.** If you do not know the answer to a question, you must say "I don't know".
3. **Do NOT hallucinate facts.** Do not invent companies, deadlines, or portal features.
4. If unsure, remind the student to contact their college placement cell for official information.`;

        console.log(`LLMService: Initialized with model '${process.env.OLLAMA_MODEL || "mistral"}'`);
    }

    /**
     * Generates a streaming response for the given message and history.
     * @param {string} message - The current user message
     * @param {string[]} history - Array of previous message contents
     * @returns {AsyncGenerator<string>} - Generator yielding text chunks
     */
    async *streamAnswer(message, history = []) {
        // Fallback to OpenAI if API key is provided
        if (process.env.OPENAI_API_KEY) {
            try {
                console.log(`LLMService: Streaming answer via OpenAI for input: "${message.substring(0, 50)}..."`);
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                
                // Format history into Chat Completion format: { role: 'user' | 'assistant', content: string }
                const messages = [
                    { role: 'system', content: this.systemPrompt },
                    ...history.map((msg, index) => ({
                        role: index % 2 === 0 ? 'user' : 'assistant',
                        content: msg
                    })),
                    { role: 'user', content: message }
                ];

                const stream = await openai.chat.completions.create({
                    model: 'gpt-4o-mini', // Fast and cheap model
                    messages: messages,
                    stream: true,
                    temperature: 0.2
                });

                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        yield content;
                    }
                }
                return; // Exit generator successfully
            } catch (openaiError) {
                console.error('OpenAI Chat Stream Error:', openaiError);
            }
        }

        const chain = this.createChain(history);
        try {
            console.log(`LLMService: Streaming answer for input: "${message.substring(0, 50)}..."`);
            const stream = await chain.stream({ input: message });
            for await (const chunk of stream) {
                yield chunk;
            }
        } catch (error) {
            console.error('LLM Stream Error:', error);
            // Check if Ollama is likely not running
            if (error.message && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))) {
                yield "I'm having trouble connecting to my local brain (Ollama). Please ensure Ollama is running on your machine.";
            } else {
                yield "I encountered an error while processing your request.";
            }
        }
    }

    /**
     * Internal method to construct the LangChain prompt chain
     * @private
     */
    createChain(history) {
        // Construct message history for the prompt
        const messages = [
            ['system', this.systemPrompt],
            ...history.map((msg, index) => [index % 2 === 0 ? 'human' : 'assistant', msg]),
            ['human', '{input}']
        ];

        const prompt = ChatPromptTemplate.fromMessages(messages);
        return prompt.pipe(this.model).pipe(new StringOutputParser());
    }
}

// Singleton instance
module.exports = new LLMService();

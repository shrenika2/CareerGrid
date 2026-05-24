import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to handle chatbot state, streaming responses, and session persistence.
 */
export const useChatbot = () => {
    // Chat history state
    const [messages, setMessages] = useState([]);
    // Loading state for the AI response
    const [isLoading, setIsLoading] = useState(false);
    // Unique session ID for the current chat
    const [chatId, setChatId] = useState(null);
    // Error state
    const [error, setError] = useState(null);

    // Load session and history from localStorage on mount
    useEffect(() => {
        const savedChatId = localStorage.getItem('saarthi_chat_id');
        const savedMessages = localStorage.getItem('saarthi_chat_history');

        if (savedChatId) setChatId(savedChatId);
        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages));
            } catch (e) {
                console.error("Failed to parse saved messages", e);
            }
        }
    }, []);

    // Save history to localStorage whenever it changes
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('saarthi_chat_history', JSON.stringify(messages));
        }
        if (chatId) {
            localStorage.setItem('saarthi_chat_id', chatId);
        }
    }, [messages, chatId]);

    /**
     * Sends a message to the chatbot API and handles the NDJSON stream.
     */
    const sendMessage = async (userInput) => {
        if (!userInput.trim()) return;

        // Add user message to state
        const userMessage = { role: 'user', content: userInput, timestamp: Date.now() };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setError(null);

        // Placeholder for the AI message that we will update as chunks arrive
        const assistantMessageId = Date.now() + 1;
        let fullAssistantContent = "";

        const headers = { 'Content-Type': 'application/json' };
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const { token } = JSON.parse(userInfo);
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            } catch (e) {
                console.error('Failed to parse token for chatbot', e);
            }
        }

        try {
            const response = await fetch('/api/chatbot/chat', {
                method: 'POST',
                headers,
                body: JSON.stringify({ message: userInput, chatId })
            });

            if (!response.ok) throw new Error('Failed to connect to Saarthi');

            // Set up NDJSON reader
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // NDJSON splits by newline
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const data = JSON.parse(line);

                        // Handle Metadata (ChatId)
                        if (data.type === 'metadata' && data.chatId) {
                            setChatId(data.chatId);
                        }

                        // Handle Token chunks
                        if (data.token) {
                            fullAssistantContent += data.token;

                            // Update the last message in the state with the partial content
                            if (isFirstChunk) {
                                setMessages(prev => [...prev, {
                                    id: assistantMessageId,
                                    role: 'assistant',
                                    content: fullAssistantContent,
                                    timestamp: Date.now()
                                }]);
                                isFirstChunk = false;
                            } else {
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const index = updated.findIndex(m => m.id === assistantMessageId);
                                    if (index !== -1) {
                                        updated[index] = { ...updated[index], content: fullAssistantContent };
                                    }
                                    return updated;
                                });
                            }
                        }
                    } catch (e) {
                        // Sometimes chunks cut off JSON strings, fetch handles the stream but we check validity
                        console.warn("Partial or invalid JSON chunk", e);
                    }
                }
            }
        } catch (err) {
            console.error("Chat Error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Clears local state and localStorage
     */
    const clearChat = () => {
        setMessages([]);
        setChatId(null);
        localStorage.removeItem('saarthi_chat_id');
        localStorage.removeItem('saarthi_chat_history');
    };

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        clearChat
    };
};

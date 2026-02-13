import React, { useState, useRef, useEffect } from 'react';
import { VscSend, VscClose, VscSparkle, VscAccount, VscRobot, VscLoading } from 'react-icons/vsc';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AiAgentPanelProps {
    onClose: () => void;
}

const AiAgentPanel: React.FC<AiAgentPanelProps> = ({ onClose }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: trimmedInput,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const data = await window.electronAPI.aiChat(
                messages.concat(userMessage).map(m => ({
                    role: m.role,
                    content: m.content
                }))
            );

            // Handle different possible response formats from the user's server
            let botContent = "No response received.";

            if (typeof data.content === 'string') {
                botContent = data.content;
            } else if (Array.isArray(data.content)) {
                // Handle Anthropic/Claude style content array
                botContent = data.content
                    .map((block: any) => block.text || block.content || "")
                    .join("\n");
            } else if (data.message) {
                botContent = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
            } else if (data.choices && data.choices[0]?.message?.content) {
                botContent = data.choices[0].message.content;
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: botContent,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error calling AI API:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Error: Could not connect to the AI server. ${error instanceof Error ? error.message : 'Unknown error'}.`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: '#252526',
            borderLeft: '1px solid #333',
            color: '#cccccc',
            fontFamily: 'var(--vscode-font-family)'
        }}>
            <div style={{
                padding: '10px 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #333',
                fontWeight: '600',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: '#252526'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <VscSparkle style={{ color: '#007acc' }} />
                    <span>AI Tutor</span>
                </div>
                <VscClose
                    style={{ cursor: 'pointer', fontSize: '16px' }}
                    onClick={onClose}
                />
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '15px',
                fontSize: '13px',
                lineHeight: '1.5',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        background: '#2d2d2d',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #404040',
                        marginTop: '5px'
                    }}>
                        <strong>Hello!</strong> I'm your AI Tutor. I can help you understand code, find bugs, or suggest improvements.
                        <br /><br />
                        What can I do for you today?
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                color: '#888',
                                marginBottom: '2px',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                            }}>
                                {msg.role === 'user' ? <VscAccount size={12} /> : <VscRobot size={12} />}
                                <span>{msg.role === 'user' ? 'You' : 'Tutor'}</span>
                            </div>
                            <div style={{
                                background: msg.role === 'user' ? '#007acc' : '#2d2d2d',
                                color: 'white',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: msg.role === 'user' ? 'none' : '1px solid #404040',
                                maxWidth: '90%',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#888',
                        fontSize: '12px',
                        paddingLeft: '5px'
                    }}>
                        <VscLoading className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <div style={{
                padding: '15px',
                borderTop: '1px solid #333',
                background: '#1e1e1e'
            }}>
                <div style={{
                    position: 'relative',
                    background: '#2d2d2d',
                    borderRadius: '8px',
                    border: '1px solid #454545',
                    padding: '10px'
                }}>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything..."
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            minHeight: '60px',
                            maxHeight: '200px',
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            paddingRight: '30px',
                            fontSize: '13px',
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            opacity: isLoading ? 0.6 : 1
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        right: '10px',
                        bottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <button
                            onClick={() => handleSubmit()}
                            style={{
                                background: (input.trim() && !isLoading) ? '#007acc' : 'transparent',
                                border: 'none',
                                color: (input.trim() && !isLoading) ? 'white' : '#666',
                                borderRadius: '4px',
                                padding: '4px',
                                cursor: (input.trim() && !isLoading) ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            disabled={!input.trim() || isLoading}
                        >
                            <VscSend size={16} />
                        </button>
                    </div>
                </div>
                <div style={{
                    fontSize: '10px',
                    color: '#666',
                    marginTop: '8px',
                    textAlign: 'center'
                }}>
                    Press Enter to send, Shift + Enter for new line
                </div>
            </div>
        </div>
    );
};

export default AiAgentPanel;


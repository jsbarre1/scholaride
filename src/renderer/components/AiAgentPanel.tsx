import React, { useState } from 'react';
import { VscSend, VscClose, VscSparkle } from 'react-icons/vsc';

interface AiAgentPanelProps {
    onClose: () => void;
}

const AiAgentPanel: React.FC<AiAgentPanelProps> = ({ onClose }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (input.trim()) {
            console.log('Submitted to AI Agent:', input);
            setInput('');
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
                    <span>AI Agent</span>
                </div>
                <VscClose
                    style={{ cursor: 'pointer', fontSize: '16px' }}
                    onClick={onClose}
                />
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                fontSize: '13px',
                lineHeight: '1.6',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                <div style={{
                    background: '#2d2d2d',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #404040'
                }}>
                    <strong>Hello!</strong> I'm your AI coding assistant. I can help you understand code, find bugs, or suggest improvements.
                    <br /><br />
                    What can I do for you today?
                </div>
            </div>

            <div style={{
                padding: '20px',
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
                            fontFamily: 'inherit'
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
                                background: input.trim() ? '#007acc' : 'transparent',
                                border: 'none',
                                color: input.trim() ? 'white' : '#666',
                                borderRadius: '4px',
                                padding: '4px',
                                cursor: input.trim() ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            disabled={!input.trim()}
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

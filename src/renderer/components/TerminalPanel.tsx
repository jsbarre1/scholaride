import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const TerminalPanel: React.FC = () => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const listenersRef = useRef<(() => void)[]>([]);

    useEffect(() => {
        if (!terminalRef.current) return;

        const initTerminal = () => {
            if (xtermRef.current) return;

            // Double check dimensions before opening
            if (terminalRef.current.clientWidth === 0 || terminalRef.current.clientHeight === 0) {
                return;
            }

            try {
                const term = new Terminal({
                    theme: {
                        background: '#1e1e1e',
                        foreground: '#cccccc',
                        cursor: '#cccccc',
                        selectionBackground: 'rgba(255, 255, 255, 0.3)',
                    },
                    fontSize: 12,
                    fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
                    cursorBlink: true,
                    allowProposedApi: true,
                });

                const fitAddon = new FitAddon();
                term.loadAddon(fitAddon);

                term.open(terminalRef.current);

                xtermRef.current = term;
                fitAddonRef.current = fitAddon;

                // Setup listeners
                const handleData = (data: string) => {
                    if (term.element?.offsetWidth) {
                        term.write(data);
                    }
                };

                const removeIpcListener = window.electronAPI.onTerminalData(handleData);
                listenersRef.current.push(removeIpcListener);

                const disposable = term.onData((data) => {
                    window.electronAPI.sendTerminalInput(data);
                });
                listenersRef.current.push(() => disposable.dispose());

                // Initial fit
                requestAnimationFrame(() => {
                    try {
                        fitAddon.fit();
                        if (term.cols > 0 && term.rows > 0) {
                            window.electronAPI.resizeTerminal(term.cols, term.rows);
                        }
                    } catch (e) {
                        console.warn('Initial fit failed:', e);
                    }
                });

            } catch (e) {
                console.error('Terminal initialization failed:', e);
            }
        };

        const safeFit = () => {
            if (!xtermRef.current || !fitAddonRef.current || !terminalRef.current) return;
            if (terminalRef.current.clientWidth === 0 || terminalRef.current.clientHeight === 0) return;

            requestAnimationFrame(() => {
                try {
                    fitAddonRef.current?.fit();
                    const term = xtermRef.current;
                    if (term && term.cols > 0 && term.rows > 0) {
                        window.electronAPI.resizeTerminal(term.cols, term.rows);
                    }
                } catch (e) {
                    // Ignore fit errors during resize
                }
            });
        };

        const resizeObserver = new ResizeObserver(() => {
            if (!xtermRef.current) {
                initTerminal();
            } else {
                safeFit();
            }
        });

        resizeObserver.observe(terminalRef.current);

        return () => {
            resizeObserver.disconnect();
            listenersRef.current.forEach(cleanup => cleanup());
            listenersRef.current = [];

            if (xtermRef.current) {
                try {
                    xtermRef.current.dispose();
                } catch (e) {
                    console.warn('Terminal dispose error:', e);
                }
                xtermRef.current = null;
                fitAddonRef.current = null;
            }
        };
    }, []);

    return (
        <div style={{ height: '100%', width: '100%', background: '#1e1e1e', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '30px', display: 'flex', alignItems: 'center', marginBottom: '5px', borderBottom: '1px solid #333', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#bbbbbb', textTransform: 'uppercase', marginRight: '20px' }}>Terminal</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <div ref={terminalRef} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} />
            </div>
        </div>
    );
};

export default TerminalPanel;

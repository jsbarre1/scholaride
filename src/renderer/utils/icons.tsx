import React from 'react';
import { VscFile } from 'react-icons/vsc';
import {
    SiPython,
    SiJavascript,
    SiTypescript,
    SiHtml5,
    SiCss3,
    SiMarkdown,
    SiJson
} from 'react-icons/si';

export const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'py': return <SiPython size={14} />;
        case 'js':
        case 'jsx': return <SiJavascript size={12} />;
        case 'ts':
        case 'tsx': return <SiTypescript size={12} />;
        case 'html': return <SiHtml5 size={14} />;
        case 'css': return <SiCss3 size={14} />;
        case 'md': return <SiMarkdown size={14} />;
        case 'json': return <SiJson size={14} />;
        default: return <VscFile size={16} />;
    }
};

export const getIconColor = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'py': return '#3776ab';
        case 'js':
        case 'jsx': return '#f7df1e';
        case 'ts':
        case 'tsx': return '#3178c6';
        case 'html': return '#e34f26';
        case 'css': return '#1572b6';
        case 'md': return '#42a5f5';
        case 'json': return '#cbcb41';
        default: return '#858585';
    }
};

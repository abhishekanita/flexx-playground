"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TypewriterTextProps {
    texts: string[];
    typingSpeed?: number; // milliseconds per character
    delayBetweenTexts?: number; // milliseconds between texts
    isRepeat?: boolean;
    onComplete?: () => void;
    className?: string;
}

export const TypewriterText = ({
    texts,
    typingSpeed = 30,
    delayBetweenTexts = 2000,
    isRepeat = false,
    onComplete,
    className = '',
}: TypewriterTextProps) => {
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        if (currentTextIndex >= texts.length) {
            if (isRepeat) {
                setCurrentTextIndex(0);
            } else {
                onComplete?.();
                return;
            }
        }

        const currentText = texts[currentTextIndex];
        let charIndex = 0;
        setIsTyping(true);

        const typingInterval = setInterval(() => {
            if (charIndex <= currentText.length) {
                setDisplayedText(currentText.slice(0, charIndex));
                charIndex++;
            } else {
                clearInterval(typingInterval);
                setIsTyping(false);

                // Wait before showing next text
                setTimeout(() => {
                    setCurrentTextIndex(prev => prev + 1);
                    setDisplayedText('');
                }, delayBetweenTexts);
            }
        }, typingSpeed);

        return () => clearInterval(typingInterval);
    }, [currentTextIndex, texts, typingSpeed, delayBetweenTexts, isRepeat, onComplete]);

    if (currentTextIndex >= texts.length && !isRepeat) {
        return null;
    }

    return (
        <AnimatePresence mode="wait">
            <motion.p
                key={currentTextIndex}
                className={`font-medium text-gray-alpha-700 ${className}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
            >
                {displayedText}
                {isTyping && <span className="animate-pulse ml-0.5">|</span>}
            </motion.p>
        </AnimatePresence>
    );
};

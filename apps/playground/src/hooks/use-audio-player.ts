import { useCallback, useEffect, useRef } from 'react';

// --- Shared single AudioContext across the app (saves CPU/memory)
const getAudioContext = (() => {
    let ctx: AudioContext | null = null;
    return () => {
        if (typeof window === 'undefined') return null;
        // @ts-ignore - Safari prefix
        const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        if (!ctx) ctx = new AC();
        return ctx;
    };
})();

// Caches so the same src is fetched/decoded only once
const decodedBufferCache = new Map<string, AudioBuffer>();
const decodeInFlightCache = new Map<string, Promise<AudioBuffer>>();

// Small fetch -> decode pipeline w/ caching
async function loadDecodedBuffer(src: string, ctx: AudioContext): Promise<AudioBuffer> {
    // already decoded
    const cached = decodedBufferCache.get(src);
    if (cached) return cached;

    // decoding already in progress
    const inflight = decodeInFlightCache.get(src);
    if (inflight) return inflight;

    const p = (async () => {
        const res = await fetch(src, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr.slice(0)); // slice for Safari decode bug safety
        decodedBufferCache.set(src, buf);
        return buf;
    })();

    decodeInFlightCache.set(src, p);
    try {
        return await p;
    } finally {
        // keep decoded in cache, but clear the in-flight marker
        decodeInFlightCache.delete(src);
    }
}

export interface UseAudioPlayerOptions {
    /** 0.0 - 1.0 (default 1) */
    volume?: number;
    /** playback speed (default 1) */
    playbackRate?: number;
    /** if true, stop any currently playing instance before starting (default true) */
    interrupt?: boolean;
}

/**
 * useAudioPlayer
 * Minimal, optimized hook: pass a WAV path, get a play() function.
 *
 * Example:
 * const play = useAudioPlayer("/sounds/ping.wav", { volume: 0.8 });
 * <button onClick={play}>Play</button>
 */
export function useAudioPlayer(src: string | null | undefined, opts: UseAudioPlayerOptions = {}): () => Promise<void> {
    const { volume = 1, playbackRate = 1, interrupt = true } = opts;

    const ctxRef = useRef<AudioContext | null>(null);
    const bufferRef = useRef<AudioBuffer | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // HTMLAudio fallback (very rarely needed, but robust)
    const htmlAudioRef = useRef<HTMLAudioElement | null>(null);

    // Preload & decode once per src
    useEffect(() => {
        bufferRef.current = null;
        htmlAudioRef.current = null;

        if (!src) return;

        const ctx = getAudioContext();
        ctxRef.current = ctx;

        let cancelled = false;

        (async () => {
            if (ctx) {
                try {
                    const buf = await loadDecodedBuffer(src, ctx);
                    if (cancelled) return;
                    bufferRef.current = buf;

                    // lazily create a single gain node for volume control
                    if (!gainRef.current) {
                        gainRef.current = ctx.createGain();
                        gainRef.current.connect(ctx.destination);
                    }
                    if (gainRef.current) {
                        gainRef.current.gain.value = Math.max(0, Math.min(1, volume));
                    }
                    return;
                } catch {
                    // fallthrough to HTMLAudio fallback below
                }
            }

            // Fallback
            const a = new Audio(src);
            a.preload = 'auto';
            a.volume = Math.max(0, Math.min(1, volume));
            htmlAudioRef.current = a;
            await a.load?.();
        })();

        return () => {
            cancelled = true;
            // stop any ongoing
            try {
                currentSourceRef.current?.stop();
            } catch {}
            currentSourceRef.current = null;
        };
    }, [src, volume]);

    // Keep gain + rate in sync without re-creating play()
    useEffect(() => {
        if (gainRef.current) {
            gainRef.current.gain.value = Math.max(0, Math.min(1, volume));
        }
    }, [volume]);

    const play = useCallback(async (): Promise<void> => {
        if (!src) return;

        // Web Audio path
        const ctx = ctxRef.current ?? getAudioContext();
        if (ctx && bufferRef.current) {
            // resume context if suspended (autoplay policy)
            if (ctx.state === 'suspended') {
                try {
                    await ctx.resume();
                } catch {
                    /* ignore */
                }
            }

            if (interrupt && currentSourceRef.current) {
                try {
                    currentSourceRef.current.stop();
                } catch {}
                currentSourceRef.current = null;
            }

            // Create a fresh buffer source each play
            const source = ctx.createBufferSource();
            source.buffer = bufferRef.current;
            source.playbackRate.value = playbackRate > 0 ? playbackRate : 1;

            // Ensure gain node exists and is connected
            if (!gainRef.current) {
                const g = ctx.createGain();
                g.gain.value = Math.max(0, Math.min(1, volume));
                g.connect(ctx.destination);
                gainRef.current = g;
            }

            source.connect(gainRef.current!);
            currentSourceRef.current = source;

            source.onended = () => {
                if (currentSourceRef.current === source) {
                    currentSourceRef.current = null;
                }
            };

            source.start(0);
            return;
        }

        // Fallback: HTMLAudioElement
        const a = htmlAudioRef.current;
        if (a) {
            try {
                if (interrupt) {
                    a.pause();
                    a.currentTime = 0;
                }
                a.playbackRate = playbackRate > 0 ? playbackRate : 1;
                a.volume = Math.max(0, Math.min(1, volume));
                await a.play();
            } catch {
                // ignore
            }
        }
    }, [src, volume, playbackRate, interrupt]);

    return play;
}

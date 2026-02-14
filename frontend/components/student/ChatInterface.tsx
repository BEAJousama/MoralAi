import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, ArrowLeft, Volume2, Loader2, Bell, CheckCheck, PhoneOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChatMessage } from '../../types';
import { sendMessageToBackend, getChatOpening, getTtsAudioUrl, sendAudioForStt } from '../../services/backendService';
import { submitAssessment, getUnreadNotificationCount, markAllNotificationsRead, type AssessmentResult } from '../../services/authService';
import { Button } from '../Button';
import { AssessmentForm } from './AssessmentForm';
import { SoundWaveVisualizer } from './SoundWaveVisualizer';

const SILENCE_MS = 1800;
const MIN_RECORDING_MS = 800;
const VOLUME_THRESHOLD = 28;

interface ChatInterfaceProps {
  authToken: string | null;
  onBack: () => void;
  onOpenNotifications?: () => void;
  onComplete: (assessment: AssessmentResult) => void;
}

const FALLBACK_OPENING = "Salam 👋\n\nبغيت نسمع منك، كيفاش كتحس اليوم؟\n\nتقدر تهضر أو تكتب—لي بغيتي.";

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ authToken, onBack, onOpenNotifications, onComplete }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openingLoading, setOpeningLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [playingTtsId, setPlayingTtsId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [showFormFallback, setShowFormFallback] = useState(false);
  const [clearingNotifications, setClearingNotifications] = useState(false);
  const [voiceChatMode, setVoiceChatMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceChatModeRef = useRef(voiceChatMode);
  voiceChatModeRef.current = voiceChatMode;
  const startRecordingRef = useRef<() => void>(() => {});

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const lastLoudAtRef = useRef<number>(0);
  const hasSpokenRef = useRef<boolean>(false);
  const freqDataRef = useRef<Uint8Array | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const playTtsRef = useRef<(msg: ChatMessage) => void>(() => {});

  // AI starts the conversation: fetch opening message on mount and auto-play voice
  useEffect(() => {
    let cancelled = false;
    setOpeningLoading(true);
    getChatOpening()
      .then((text) => {
        if (!cancelled) {
          const msg: ChatMessage = { id: '1', role: 'model', text: text.trim() || FALLBACK_OPENING, timestamp: new Date() };
          setMessages([msg]);
          playTtsRef.current(msg);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const msg: ChatMessage = { id: '1', role: 'model', text: FALLBACK_OPENING, timestamp: new Date() };
          setMessages([msg]);
          playTtsRef.current(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setOpeningLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authToken || !onOpenNotifications) return;
    getUnreadNotificationCount(authToken).then(setUnreadNotifications).catch(() => setUnreadNotifications(0));
  }, [authToken, onOpenNotifications]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    let aiResponseText: string;
    try {
      aiResponseText = await sendMessageToBackend(history, trimmed);
    } catch {
      aiResponseText = "I'm on a little break right now — think of me as napping or on leave 🌙 Maybe I had too much coffee and need a reset. Try again in a minute, or use the form to complete your check-in. I'll be back soon!";
    }

    setIsTyping(false);
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: aiResponseText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, aiMsg]);
    playTts(aiMsg);
  };

  const handleSend = () => {
    sendMessage(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    setSttError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (silenceCheckIntervalRef.current) {
          clearInterval(silenceCheckIntervalRef.current);
          silenceCheckIntervalRef.current = null;
        }
        if (audioContextRef.current) {
          try {
            await audioContextRef.current.close();
          } catch {
            /* ignore */
          }
          audioContextRef.current = null;
        }
        analyserRef.current = null;
        stream?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (chunksRef.current.length === 0) {
          setSttError('No audio recorded. Try again.');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mime });
        setIsTranscribing(true);
        try {
          const text = (await sendAudioForStt(blob))?.trim();
          if (text) {
            sendMessage(text);
          } else {
            setSttError('No speech detected. Try again.');
          }
        } catch (err) {
          setSttError(err instanceof Error ? err.message : 'Speech recognition failed');
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      setIsListening(true);

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      recordingStartRef.current = Date.now();
      lastLoudAtRef.current = Date.now();
      hasSpokenRef.current = false;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      silenceCheckIntervalRef.current = setInterval(() => {
        const ana = analyserRef.current;
        const freq = freqDataRef.current;
        if (!ana || !freq) return;
        ana.getByteFrequencyData(freq);
        const avg = freq.reduce((a, b) => a + b, 0) / freq.length;
        const now = Date.now();
        if (avg > VOLUME_THRESHOLD) {
          lastLoudAtRef.current = now;
          hasSpokenRef.current = true;
        } else if (
          hasSpokenRef.current &&
          now - lastLoudAtRef.current >= SILENCE_MS &&
          now - recordingStartRef.current >= MIN_RECORDING_MS
        ) {
          if (silenceCheckIntervalRef.current) {
            clearInterval(silenceCheckIntervalRef.current);
            silenceCheckIntervalRef.current = null;
          }
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
          }
          setIsListening(false);
        }
      }, 150);
    } catch (err) {
      setSttError(err instanceof Error ? err.message : 'Microphone access denied or unavailable');
    }
  };

  const stopRecording = () => {
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) stopRecording();
    else startRecording();
  };

  const handleFinish = async () => {
    if (!authToken) {
      setAssessmentError('You must be logged in to save your assessment.');
      return;
    }
    setAssessmentError(null);
    setIsSubmittingAssessment(true);
    try {
      const messagesForApi = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const assessment = await submitAssessment(authToken, messagesForApi);
      onComplete(assessment);
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Could not save assessment. Try again.');
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const playTts = async (msg: ChatMessage) => {
    if (msg.role !== 'model' || !msg.text.trim()) return;
    setTtsError(null);
    if (playingTtsId) {
      audioRef.current?.pause();
      setPlayingTtsId(null);
      if (playingTtsId === msg.id) return;
    }
    setPlayingTtsId(msg.id);
    try {
      const url = await getTtsAudioUrl(msg.text);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingTtsId(null);
        if (voiceChatModeRef.current) {
          setTimeout(() => {
            if (voiceChatModeRef.current && !mediaRecorderRef.current) startRecordingRef.current();
          }, 500);
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlayingTtsId(null);
        setTtsError('Playback failed. Try again or check your volume.');
      };
      await audio.play();
    } catch (err) {
      setPlayingTtsId(null);
      const message = err instanceof Error ? err.message : 'Could not load audio';
      setTtsError(message);
      setTimeout(() => setTtsError(null), 6000);
    }
  };

  useEffect(() => {
    playTtsRef.current = playTts;
  }, [playTts]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const handleClearNotifications = async () => {
    if (!authToken || unreadNotifications === 0) return;
    setClearingNotifications(true);
    try {
      await markAllNotificationsRead(authToken);
      setUnreadNotifications(0);
    } catch {
      // ignore
    } finally {
      setClearingNotifications(false);
    }
  };

  const startRealtimeVoice = () => {
    setVoiceChatMode(true);
    setSttError(null);
    setTimeout(() => startRecording(), 100);
  };

  const endRealtimeVoice = () => {
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
    setVoiceChatMode(false);
  };

  const voiceStatus =
    isListening ? 'Listening… speak and pause when done' :
    isTranscribing ? 'Transcribing…' :
    isTyping ? 'Thinking…' :
    playingTtsId ? 'MoraLai is speaking…' :
    'Starting…';

  return (
    <div className="flex flex-col h-screen bg-cream-light">
      {/* Header - fixed */}
      <header className="flex items-center justify-between px-4 py-3 bg-white shadow-soft z-10 fixed top-0 left-0 right-0">
        <div className="flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-charcoal">
            <ArrowLeft size={24} />
          </button>
          {onOpenNotifications && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative p-2 rounded-full hover:bg-slate-100 text-charcoal"
                aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
              >
                <Bell size={22} />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-warmCoral-risk text-white text-xs font-bold">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>
              {unreadNotifications > 0 && (
                <button
                  type="button"
                  onClick={handleClearNotifications}
                  disabled={clearingNotifications}
                  className="text-xs text-gentleBlue-text hover:text-sage font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-60"
                  title="Mark all as read"
                >
                  {clearingNotifications ? <Loader2 size={14} className="animate-spin" /> : <><CheckCheck size={14} /> Clear</>}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center">
          <span className="font-semibold text-charcoal">MoraLai</span>
          <span className="text-xs text-gentleBlue-text flex items-center">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
            Online
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!showFormFallback && (
            <button
              type="button"
              onClick={() => setShowFormFallback(true)}
              className="text-xs text-gentleBlue-text hover:text-sage hidden sm:block"
            >
              Use form
            </button>
          )}
          <button
            onClick={handleFinish}
            disabled={isSubmittingAssessment || showFormFallback}
            className="text-sage font-medium text-sm px-2 py-1 hover:bg-sage-50 rounded-lg disabled:opacity-60"
          >
            {isSubmittingAssessment ? 'Saving…' : 'Finish'}
          </button>
        </div>
      </header>

      {/* Chat Area or Form fallback */}
      <div className="flex-1 overflow-y-auto p-4 pt-20 transition-all duration-300">
        {showFormFallback ? (
          <div className="max-w-lg mx-auto py-4">
            <AssessmentForm
              authToken={authToken}
              onSubmit={onComplete}
              onCancel={() => { setShowFormFallback(false); setAssessmentError(null); }}
              submitLabel="Submit & see results"
            />
          </div>
        ) : (
          <>
      <div className="space-y-6">
        {openingLoading && messages.length === 0 && (
          <div className="flex items-center space-x-2 text-gentleBlue-text text-sm">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-sage rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-sage rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-sage rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>MoraLai is saying hi…</span>
          </div>
        )}
        {voiceChatMode && messages.length > 0 && (
          <p className="text-xs font-medium text-gentleBlue-text uppercase tracking-wider mb-2 px-1">Transcript</p>
        )}
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {voiceChatMode && (
              <span className={`text-xs font-medium text-gentleBlue-text mb-0.5 ${msg.role === 'user' ? 'pr-1' : 'pl-1'}`}>
                {msg.role === 'user' ? 'You' : 'MoraLai'}
              </span>
            )}
            <div
              className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl text-base leading-relaxed shadow-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-sage-light text-charcoal rounded-br-none'
                  : 'bg-lavender-light text-charcoal rounded-bl-none'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1">{msg.text}</span>
                {msg.role === 'model' && (
                  <button
                    type="button"
                    onClick={() => playTts(msg)}
                    className="shrink-0 p-1.5 rounded-full text-gentleBlue-light hover:bg-sage/20 hover:text-sage transition-colors"
                    title="Listen"
                    aria-label="Listen to message"
                  >
                    {playingTtsId === msg.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                )}
              </div>
            </div>
            <span className="text-[10px] text-gray-400 mt-1 px-1">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex items-center space-x-1 p-4 bg-lavender-light rounded-2xl rounded-bl-none w-fit">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

          </>
        )}
      </div>

      {(ttsError || sttError || assessmentError) && (
        <div className="mx-4 mb-2 px-4 py-3 rounded-lg bg-warmCoral-bg text-warmCoral-text text-sm space-y-2">
          <p>{ttsError || sttError || assessmentError}</p>
          {assessmentError && (
            <p className="pt-1">
              <button
                type="button"
                onClick={() => setShowFormFallback(true)}
                className="font-semibold underline hover:no-underline"
              >
                Complete your check-in with the form instead →
              </button>
            </p>
          )}
        </div>
      )}

      {/* Input Area (hidden when form is shown) */}
      {!showFormFallback && (
      <div className="p-4 bg-white border-t border-gray-100">
        {voiceChatMode ? (
          /* ChatGPT-style: auto-detect silence and send; no mic button; transcript + sound waves */
          <div className="max-w-md mx-auto flex flex-col items-center gap-4">
            <p className="text-sm text-gentleBlue-text font-medium text-center">{voiceStatus}</p>
            <div className="w-full flex flex-col items-center gap-4 py-2">
              <SoundWaveVisualizer
                mode={isListening ? 'live' : 'playback'}
                analyserRef={analyserRef}
                isActive={isListening || !!playingTtsId || isTranscribing || isTyping}
                className="min-h-[40px]"
              />
              <button
                type="button"
                onClick={endRealtimeVoice}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-100 text-charcoal hover:bg-gray-200 font-medium text-sm transition-colors"
              >
                <PhoneOff size={18} />
                End voice chat
              </button>
            </div>
          </div>
        ) : (
          /* Normal chat: text input + Start voice chat button */
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <button
              type="button"
              onClick={startRealtimeVoice}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-sage text-white hover:bg-sage/90 font-medium text-sm shrink-0"
              title="Start real-time voice chat"
            >
              <Mic size={20} />
              Start voice chat
            </button>
            <div className="flex-1 relative flex items-center min-h-[52px]">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Or type your message..."
                className="w-full pl-5 pr-12 py-3.5 bg-white border-2 border-cream-dark rounded-[26px] focus:outline-none focus:border-sage focus:ring-4 focus:ring-sage/10 resize-none overflow-hidden min-h-[52px] max-h-32 text-charcoal placeholder-gray-400 align-middle"
                rows={1}
              />
              <button
                type="button"
                onClick={toggleListening}
                disabled={isTranscribing}
                title={isListening ? 'Stop recording' : 'Speak'}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
                  isListening ? 'bg-warmCoral text-white animate-pulse' : 'text-gentleBlue-light hover:text-sage'
                } ${isTranscribing ? 'opacity-70' : ''}`}
                aria-label={isListening ? 'Stop recording' : 'Start voice input'}
              >
                {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
              </button>
            </div>
            <Button
              onClick={handleSend}
              disabled={!inputText.trim() && !isListening}
              className="rounded-full w-[52px] h-[52px] min-w-[52px] min-h-[52px] !p-0 flex items-center justify-center shrink-0 self-center"
            >
              <Send size={20} className="ml-0.5" />
            </Button>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

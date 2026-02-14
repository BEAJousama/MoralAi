import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize the client only if the key exists to avoid immediate errors if not set
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const sendMessageToGemini = async (history: { role: string; parts: { text: string }[] }[], newMessage: string) => {
  if (!ai) {
    // Fallback if no API key is present for demo purposes
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve("I'm currently in demo mode. Please configure the API Key to have a real conversation. But I'm here to listen!");
      }, 1000);
    });
  }

  try {
    const model = 'gemini-2.5-flash-latest'; // Fast and conversational
    const systemInstruction = `
      You are MoraLai, a warm, empathetic, and non-judgmental mental health companion for university students.
      Your goal is to provide a safe space for students to check in with themselves.
      
      Tone & Voice:
      - Warm, conversational, and supportive (like a caring friend).
      - Professional but NOT clinical or robotic.
      - Calming and reassuring.
      
      Guidelines:
      - Validate feelings ("It sounds like you're carrying a lot right now").
      - Ask open-ended, gentle questions.
      - Keep responses concise (under 3 paragraphs).
      - If a user expresses severe distress or self-harm, gently encourage professional help while remaining supportive, but do not act as a crisis service.
      - Use soft emojis occasionally (🌿, 🌤️, 💙) to keep the tone friendly.
    `;

    // Transform history for the API
    const contents = [
      ...history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: msg.parts
      })),
      {
        role: 'user',
        parts: [{ text: newMessage }]
      }
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7, // Balanced creativity and coherence
      }
    });

    return response.text || "I'm having a little trouble connecting right now, but I'm listening.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I apologize, I'm having a brief technical moment. Let's try that again.";
  }
};

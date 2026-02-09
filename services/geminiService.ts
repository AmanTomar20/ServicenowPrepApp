
import { GoogleGenAI } from "@google/genai";
import { Question } from "../types";

export const getAiExplanation = async (question: Question, userSelected: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Question: ${question.text}
    Options: ${question.options.join(', ')}
    Correct Answer Indices: ${question.correctIndices.join(', ')}
    User selected: ${userSelected.join(', ')}
    
    Provide a concise, professional explanation of why the correct answers are right and why the incorrect ones are wrong. 
    Make it helpful for a student learning the topic. Keep it under 100 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Sorry, I couldn't generate an explanation at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI explanation unavailable. Check your internet connection.";
  }
};

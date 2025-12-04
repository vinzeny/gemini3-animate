import { GoogleGenAI } from "@google/genai";
import { EffectType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getEffectExplanation = async (effect: EffectType): Promise<string> => {
  try {
    const prompt = `
      解释如何在 Three.js (WebGL) 中从技术上实现 "${effect}" 粒子效果。
      请将回答限制在3句话以内。
      重点关注数学概念（例如：波浪的正弦波、星系的极坐标、雨滴的速度向量）。
      不要包含代码块，仅提供纯文本解释。请用中文回答。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "无法获取解释。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "暂时无法加载 AI 解释。";
  }
};
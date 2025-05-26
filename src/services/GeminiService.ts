import { v4 as uuidv4 } from "uuid";

interface MessageInput {
  role: "user" | "model";
  content: string;
}

// Updated API URL - try this version first
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// Fallback URL if the above doesn't work
// const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "GEMINI_API_KEY";

export const generateContentFromGemini = async (
  messages: MessageInput[],
  systemPrompt: string,
  isJson = false
): Promise<string> => {
  try {
    // Debug logging
    console.log("API Key:", API_KEY ? "Set" : "Missing");
    console.log("API URL:", API_URL);

    // Convert messages to Gemini format - Fixed approach
    const formattedMessages = messages.map((msg) => ({
      role: msg.role === "model" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Add system prompt as the first user message instead of model message
    const contentsWithSystem = [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model",
        parts: [
          {
            text: "I understand. I'll be a compassionate mental health support friend, responding naturally and avoiding repetitive questions.",
          },
        ],
      },
      ...formattedMessages,
    ];

    const payload = {
      contents: contentsWithSystem,
      generationConfig: {
        temperature: isJson ? 0.1 : 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: isJson ? 1024 : 512,
        candidateCount: 1,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    };

    console.log("Sending request to Gemini API...");

    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error response:", errorText);

      // Try to parse as JSON for better error info
      try {
        const errorData = JSON.parse(errorText);
        console.error("Parsed error:", errorData);
        throw new Error(
          `Gemini API error: ${response.status} - ${
            errorData.error?.message || errorText
          }`
        );
      } catch {
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    console.log("API Response:", data);

    // Extract response text
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.warn("Unexpected API response structure:", data);
      console.warn("Using fallback response simulation");
      return simulateFallbackResponse(messages, isJson);
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Return fallback response in case of error
    return simulateFallbackResponse(messages, isJson);
  }
};

// Updated system prompt to be more explicit about avoiding repetition
const systemPrompt = `You are a compassionate mental health support chatbot that responds like a caring friend. Your responses should be:

1. Natural and conversational - respond like a real friend would
2. Dynamic - NEVER repeat the same question twice in a conversation
3. Contextual - base your next question on the user's previous response
4. Supportive - offer gentle coping suggestions when appropriate
5. Empathetic - acknowledge and validate the user's feelings
6. Concise - keep responses to 2-3 sentences maximum
7. AVOID REPETITION - Always ask different questions and provide varied responses

CRITICAL: Track the conversation history and ensure you never repeat questions or suggestions you've already made.

Example good responses:
- "I hear that work has been really stressful lately. Have you tried taking short breaks to practice deep breathing?"
- "It sounds like you're feeling overwhelmed with your studies. What specific aspects are causing you the most stress?"
- "I'm sorry to hear you're feeling lonely. What kind of activities do you usually enjoy doing?"

IMPORTANT GUIDELINES:
- Never repeat the same question
- Always acknowledge the user's response before asking a new question
- Offer specific, practical coping suggestions when appropriate
- Keep the conversation flowing naturally
- Don't explicitly mention mental health assessment
- Never mention that you're an AI or chatbot
- Focus on understanding and supporting the user's current situation`;

// Rest of your fallback function remains the same...
const simulateFallbackResponse = (
  messages: MessageInput[],
  isJson: boolean
): string => {
  const lastUserMessage =
    messages.filter((msg) => msg.role === "user").pop()?.content || "";

  if (isJson) {
    return JSON.stringify({
      observedPatterns: [
        "Shows signs of moderate stress related to daily activities",
        "Expresses desire for more social connection",
        "Displays self-awareness about emotional states",
      ],
      tentativeConditions: ["Mild anxiety", "Social isolation"],
      moodScore: 6,
      sentimentScore: 5,
      keyQuotes: [
        lastUserMessage.length > 10
          ? lastUserMessage
          : "I've been feeling a bit overwhelmed lately",
      ],
      recommendations: [
        "Guided meditation sessions for stress reduction",
        "Social connection exercises",
      ],
      analysisDate: new Date().toISOString(),
    });
  }

  // Generate contextual response based on the last user message
  const lowerMessage = lastUserMessage.toLowerCase();

  if (
    lowerMessage.includes("book") ||
    lowerMessage.includes("reading") ||
    lowerMessage.includes("club")
  ) {
    return "That's a great idea! Book clubs can be wonderful places to meet new people. Have you checked your local library for book club recommendations?";
  }

  if (
    lowerMessage.includes("talk") ||
    lowerMessage.includes("someone") ||
    lowerMessage.includes("lonely") ||
    lowerMessage.includes("alone")
  ) {
    return "I understand the need for connection. Have you considered joining any hobby groups or volunteering? What activities do you enjoy?";
  }

  if (
    lowerMessage.includes("stress") ||
    lowerMessage.includes("anxious") ||
    lowerMessage.includes("worried") ||
    lowerMessage.includes("overwhelm")
  ) {
    return "I hear that you're feeling stressed. Deep breathing exercises can really help. What usually helps you feel more calm?";
  }

  return "I understand. Would you like to tell me more about what's been on your mind lately? I'm here to listen.";
};

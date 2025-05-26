import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Message, Report } from "../types";
import { generateContentFromHF } from "../services/HuggingFaceService";
import { v4 as uuidv4 } from "uuid";

interface ConversationContextType {
  messages: Message[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  generateReport: () => Promise<void>;
  downloadReport: () => void;
  report: Report | null;
  isReportGenerating: boolean;
  error: string | null;
  clearError: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(
  undefined
);

const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      "useConversation must be used within a ConversationProvider"
    );
  }
  return context;
};

const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [isReportGenerating, setIsReportGenerating] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initial message from chatbot
  useEffect(() => {
    if (!conversationStarted) {
      setConversationStarted(true);
      setTimeout(() => {
        const initialMessage: Message = {
          id: uuidv4(),
          content: "Hi there! How are you feeling today?",
          sender: "bot",
          timestamp: new Date().toISOString(),
        };
        setMessages([initialMessage]);
      }, 500);
    }
  }, [conversationStarted]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    try {
      // Add user message
      const userMessage: Message = {
        id: uuidv4(),
        content,
        sender: "user",
        timestamp: new Date().toISOString(),
      };

      setMessages((prevMessages) => [...prevMessages, userMessage]);
      setIsLoading(true);
      setError(null);

      // Get all messages for context using the ref to avoid stale closure
      const allMessages = [...messagesRef.current, userMessage];

      // Prepare conversation history for Hugging Face
      const conversationHistory = allMessages.map((msg) => ({
        role: msg.sender === "user" ? ("user" as const) : ("model" as const),
        content: msg.content,
      }));

      // Create system prompt for Hugging Face
      const systemPrompt = `You are a supportive and empathetic mental health chatbot. Your responses should be natural, brief (2-3 sentences), and focused on the user's immediate message. Offer relevant suggestions when appropriate. Never repeat the prompt or conversation format in your response.`;

      // Get response from Hugging Face
      const response = await generateContentFromHF(
        conversationHistory,
        systemPrompt
      );

      if (response) {
        // Add bot response
        const botMessage: Message = {
          id: uuidv4(),
          content: response,
          sender: "bot",
          timestamp: new Date().toISOString(),
        };

        setMessages((prevMessages) => [...prevMessages, botMessage]);
      }
    } catch (error) {
      console.error("Error getting response:", error);
      setError("Failed to get response. Please try again.");

      // Add error message
      const errorMessage: Message = {
        id: uuidv4(),
        content:
          "I'm sorry, I'm having trouble responding right now. Could you try again?",
        sender: "bot",
        timestamp: new Date().toISOString(),
      };

      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateReport = useCallback(async () => {
    setIsReportGenerating(true);
    setError(null);

    try {
      // Prepare conversation history for Hugging Face using the ref
      const conversationHistory = messagesRef.current.map((msg) => ({
        role: msg.sender === "user" ? ("user" as const) : ("model" as const),
        content: msg.content,
      }));

      // Create system prompt for report generation
      const reportPrompt = `Based on the conversation history, generate a comprehensive mental health assessment report. Include:

1. Observed behavioral patterns (list 3-5 key observations)
2. Potential mental health conditions that may be present (if any)
3. A mood score from 1-10 (10 being excellent mental health)
4. A sentiment score from 1-10 (10 being very positive)
5. 2-3 key quotes from the user that were significant
6. 1-2 recommended therapy modules or approaches that might be beneficial

Format your response as a valid JSON object with the following structure:
{
  "observedPatterns": ["pattern1", "pattern2", ...],
  "tentativeConditions": ["condition1", "condition2", ...],
  "moodScore": number,
  "sentimentScore": number,
  "keyQuotes": ["quote1", "quote2", ...],
  "recommendations": ["recommendation1", "recommendation2"],
  "analysisDate": "current date in ISO format"
}

IMPORTANT: Be compassionate but honest in your assessment. If there are no signs of mental health conditions, state that the user appears to be in good mental health. Don't invent issues that aren't supported by the conversation.`;

      // Get report from Hugging Face
      const reportJson = await generateContentFromHF(
        conversationHistory,
        reportPrompt
      );

      if (reportJson) {
        try {
          // Parse JSON response
          const reportData = JSON.parse(reportJson);
          setReport(reportData);
        } catch (parseError) {
          console.error("Error parsing report JSON:", parseError);
          setError("Failed to generate a valid report. Please try again.");
          setReport({
            observedPatterns: ["Error generating comprehensive report"],
            tentativeConditions: [],
            moodScore: 5,
            sentimentScore: 5,
            keyQuotes: [],
            recommendations: ["Consider a general wellness check-in"],
            analysisDate: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setError("Failed to generate report. Please try again.");
      setReport({
        observedPatterns: ["Error generating comprehensive report"],
        tentativeConditions: [],
        moodScore: 5,
        sentimentScore: 5,
        keyQuotes: [],
        recommendations: ["Consider a general wellness check-in"],
        analysisDate: new Date().toISOString(),
      });
    } finally {
      setIsReportGenerating(false);
    }
  }, []);

  const downloadReport = useCallback(() => {
    if (!report) return;

    // Format the report data
    const reportContent = `
Mental Health Assessment Report
Generated on: ${new Date(report.analysisDate).toLocaleString()}

Mood Score: ${report.moodScore}/10
Sentiment Score: ${report.sentimentScore}/10

Observed Patterns:
${report.observedPatterns.map((pattern) => `- ${pattern}`).join("\n")}

${
  report.tentativeConditions.length > 0
    ? `
Potential Conditions:
${report.tentativeConditions.map((condition) => `- ${condition}`).join("\n")}`
    : ""
}

Key Quotes:
${report.keyQuotes.map((quote) => `- "${quote}"`).join("\n")}

Recommendations:
${report.recommendations.map((rec) => `- ${rec}`).join("\n")}
    `.trim();

    // Create a blob and download link
    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mental-health-report-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [report]);

  return (
    <ConversationContext.Provider
      value={{
        messages,
        sendMessage,
        isLoading,
        generateReport,
        downloadReport,
        report,
        isReportGenerating,
        error,
        clearError,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export { useConversation, ConversationProvider };

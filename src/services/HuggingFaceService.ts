const HF_API_URL =
  "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1";
const HF_API_KEY = import.meta.env.VITE_HF_API_KEY;

interface MessageInput {
  role: "user" | "model";
  content: string;
}

export const generateContentFromHF = async (
  messages: MessageInput[],
  systemPrompt: string
): Promise<string> => {
  // Build the prompt from the conversation history
  const prompt = [
    "You are a supportive and empathetic mental health chatbot. Respond naturally and briefly to the user's message.",
    "",
    "User: " + messages.filter((msg) => msg.role === "user").pop()?.content,
    "Assistant:",
  ].join("\n");

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 150,
        temperature: 0.7,
        return_full_text: false, // This is key - only return the generated part
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Hugging Face API error:", errorData);
    throw new Error(`Hugging Face API error: ${response.status}`);
  }

  const data = await response.json();

  let generatedText = "";

  // Extract the generated text
  if (Array.isArray(data) && data[0]?.generated_text) {
    generatedText = data[0].generated_text;
  } else if (data.generated_text) {
    generatedText = data.generated_text;
  } else {
    return "Sorry, I couldn't generate a response.";
  }

  // If return_full_text is true (or not supported), we need to extract just the new part
  if (generatedText.includes(prompt)) {
    // Remove the original prompt to get just the assistant's response
    generatedText = generatedText.replace(prompt, "").trim();
  }

  // Clean up any remaining artifacts
  generatedText = generatedText
    .replace(/^(Assistant:|Let me respond naturally to that\.?)/i, "")
    .trim();

  return (
    generatedText || "I'm glad to hear from you! How can I help you today?"
  );
};

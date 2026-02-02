export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt: string;
  example?: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "guide-beginners",
    name: "Beginner's Guide",
    description: "Create a comprehensive guide for beginners",
    category: "Tutorial",
    prompt: "Write a comprehensive beginner's guide about {topic} for people who are new to this subject. Include step-by-step instructions, common mistakes to avoid, and practical examples.",
    example: "Write a comprehensive beginner's guide about React hooks for people who are new to this subject. Include step-by-step instructions, common mistakes to avoid, and practical examples.",
  },
  {
    id: "how-to",
    name: "How-To Tutorial",
    description: "Step-by-step tutorial on how to do something",
    category: "Tutorial",
    prompt: "Write a detailed how-to tutorial on {topic}. Break it down into clear steps with explanations and include code examples or screenshots where relevant.",
    example: "Write a detailed how-to tutorial on setting up a Node.js server. Break it down into clear steps with explanations and include code examples or screenshots where relevant.",
  },
  {
    id: "comparison",
    name: "Comparison Article",
    description: "Compare different options or approaches",
    category: "Analysis",
    prompt: "Write a comparison article comparing {option1} vs {option2}. Discuss the pros and cons of each, use cases, and provide recommendations for different scenarios.",
    example: "Write a comparison article comparing React vs Vue. Discuss the pros and cons of each, use cases, and provide recommendations for different scenarios.",
  },
  {
    id: "best-practices",
    name: "Best Practices",
    description: "Share industry best practices and tips",
    category: "Guide",
    prompt: "Write an article about best practices for {topic}. Include proven strategies, common pitfalls, and actionable tips that readers can implement immediately.",
    example: "Write an article about best practices for API design. Include proven strategies, common pitfalls, and actionable tips that readers can implement immediately.",
  },
  {
    id: "explainer",
    name: "Concept Explainer",
    description: "Explain a complex concept in simple terms",
    category: "Educational",
    prompt: "Write an explainer article about {topic}. Break down complex concepts into simple, easy-to-understand explanations with real-world examples and analogies.",
    example: "Write an explainer article about machine learning. Break down complex concepts into simple, easy-to-understand explanations with real-world examples and analogies.",
  },
  {
    id: "listicle",
    name: "List Article",
    description: "Create a list-based article (e.g., Top 10, 5 Ways)",
    category: "List",
    prompt: "Write a listicle about {topic}. Create a numbered or bulleted list with detailed explanations for each item, approximately {count} items long.",
    example: "Write a listicle about productivity tools. Create a numbered or bulleted list with detailed explanations for each item, approximately 10 items long.",
  },
  {
    id: "case-study",
    name: "Case Study",
    description: "Analyze a real-world case or example",
    category: "Analysis",
    prompt: "Write a case study about {topic}. Analyze the situation, discuss the approach taken, results achieved, and lessons learned that others can apply.",
    example: "Write a case study about a successful startup. Analyze the situation, discuss the approach taken, results achieved, and lessons learned that others can apply.",
  },
  {
    id: "opinion",
    name: "Opinion Piece",
    description: "Share your perspective on a topic",
    category: "Opinion",
    prompt: "Write an opinion piece about {topic}. Share your perspective, support it with evidence and examples, and engage readers with thought-provoking insights.",
    example: "Write an opinion piece about remote work. Share your perspective, support it with evidence and examples, and engage readers with thought-provoking insights.",
  },
];

export const TEMPLATE_CATEGORIES = [
  "All",
  "Tutorial",
  "Guide",
  "Analysis",
  "Educational",
  "List",
  "Opinion",
] as const;

export function getTemplatesByCategory(category: string): PromptTemplate[] {
  if (category === "All") {
    return PROMPT_TEMPLATES;
  }
  return PROMPT_TEMPLATES.filter((template) => template.category === category);
}

export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find((template) => template.id === id);
}

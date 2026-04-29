export type TeacherTheme = "red" | "blue" | "green" | "violet" | "orange";

export type Teacher = {
  id: string;
  name: string;
  shortName: string;
  title: string;
  avatar: string;
  intro: string;
  direction: string;
  skills: string[];
  skillFile: string;
  theme: TeacherTheme;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  structuredReply?: StructuredReply;
};

export type StructuredReplyItem = {
  text: string;
  children?: StructuredReplyItem[];
};

export type StructuredReplySection = {
  title: string;
  items: StructuredReplyItem[];
};

export type StructuredReply = {
  sections: StructuredReplySection[];
  summary?: string;
};

export type StudentProfile = {
  province: string;
  score: string;
  rank: string;
  subjects: string;
  family: string;
  targetCity: string;
};

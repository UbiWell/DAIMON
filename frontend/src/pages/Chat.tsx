"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { MessageCircle, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Chat({ learnMode = false, isOpenByDefault = false }: { learnMode?: boolean, isOpenByDefault?: boolean } = {})  {
  const [isOpen, setIsOpen] = useState(isOpenByDefault);
  const [messages, setMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([]);
  const [input, setInput] = useState("");
  
  type QuizQ = {
    qid: string;
    question: string;
    choices: [string, string, string, string];
    correct: "A" | "B" | "C" | "D";
  };
  const [bank, setBank] = useState<QuizQ[]>([]);
  const [quizActive, setQuizActive] = useState(false);
  const [quizQs, setQuizQs] = useState<QuizQ[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);

  const qIndexRef = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/quiz.json");
        if (!res.ok) throw new Error("quiz.json not found");
        const data = (await res.json()) as QuizQ[];
        const valid = Array.isArray(data) && data.every(q =>
            q &&
            typeof q.qid === "string" &&
            typeof q.question === "string" &&
            Array.isArray(q.choices) &&
            q.choices.length === 4 &&
            ["A", "B", "C", "D"].includes(q.correct)
          );
          if (!valid) throw new Error("quiz.json has invalid shape");
          if (!cancelled) setBank(data);
        
      } catch(e) {
        if (!cancelled){
            setBank([])
        };
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const addBotMessage = (text: string) => {
    const botReply = { sender: "bot", text };
    setMessages((prev) => [...prev, botReply]);
  };

  const handleQuickButton = (type: string) => {
    switch (type) {
      case "troubleshoot":
        addBotMessage("Sure, tell me what’s going on and I’ll help.");
        break;
      case "email":
        addBotMessage("Would you like me to help you draft or automate an email response?");
        break;
      case "help":
        addBotMessage("Here is the FAQs and help.");
        break;
    }
  };

  const startQuiz = () => {
    if (!bank.length) {
      addBotMessage("Quiz is not available right now. (Missing or invalid quiz.json)");
      return;
    }
    const shuffled = [...bank].sort(() => Math.random() - Math.random());
    const five = shuffled.slice(0, 5);

    setQuizQs(five);

    setQuizActive(true);

    setQIndex(0);
    setScore(0);
    qIndexRef.current = 0;
    scoreRef.current = 0;

    addBotMessage("I’m going to ask you 5 questions. Reply with A/B/C/D (or the full answer).");
    setTimeout(() => askQuestion(0, five), 200);
  };

  const askQuestion = (idx: number, arr = quizQs) => {
    const q = arr[idx];
    if (!q) return;
    const [A, B, C, D] = q.choices;
    addBotMessage(
      `Q${idx + 1}. ${q.question}\n` + 
      `A) ${A}\n` + 
      `B) ${B}\n` + 
      `C) ${C}\n` +
      `D) ${D}\n`
    );
  };

  const finishQuiz = (finalScore: number, total: number) => {
    setQuizActive(false);
    addBotMessage(`Quiz complete! You scored ${finalScore}/${total} questions correct.`);
    if (finalScore <= 3) addBotMessage("No worries, a bit more practice will help!");
    else addBotMessage("Great job! 🎉");
  };

  const wrongReplies = ["Not quite.", "Close, but not correct.", "That's not it."];


  const handleQuizAnswer = (raw: string) => {
    const q = quizQs[qIndexRef.current];
    if (!q) return;

    const cleaned = raw.trim().toUpperCase().replace(/[.)\s]+$/g, "");
    let letter: "A" | "B" | "C" | "D" | "" = "";

    if (["A", "B", "C", "D"].includes(cleaned[0])) {
      letter = cleaned[0] as "A" | "B" | "C" | "D";
    } else {
      const idx = q.choices.findIndex((c) => c.trim().toUpperCase() === cleaned);
      if (idx >= 0) letter = (["A", "B", "C", "D"][idx] as "A" | "B" | "C" | "D");
    }

    const [A, B, C, D] = q.choices;
    const map: Record<"A" | "B" | "C" | "D", string> = { A, B, C, D };

    const wasCorrect = letter === q.correct;
    const newScore = scoreRef.current + (wasCorrect ? 1 : 0);
    scoreRef.current = newScore;
    setScore(newScore);
    if (wasCorrect) {
        addBotMessage("Correct!");
    } else {
        const randWrong = wrongReplies[Math.floor(Math.random() * wrongReplies.length)];
        addBotMessage(`${randWrong} The correct answer should be ${q.correct}) ${map[q.correct]}`);
    }

    const next = qIndexRef.current + 1;
    if (next >= quizQs.length) {
      setTimeout(() => finishQuiz(newScore, quizQs.length), 250);
    } else {
      qIndexRef.current = next;
      setQIndex(next);
      setTimeout(() => askQuestion(next), 250);
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);

    if (quizActive) {
        handleQuizAnswer(input);
        setInput("");
        return;
    }
  
    setInput("");

    setTimeout(() => {
        addBotMessage("Thanks for your message!");
    }, 600);
  };

  // When used as a view (isOpenByDefault), render the chat content directly
  if (isOpenByDefault) {
    return (
      <div className="h-full w-full bg-card shadow-xl border rounded-lg flex flex-col">
        <div className="flex flex-col border-b">
          <div className="flex items-center justify-between p-3 border-b">
              <h2 className="text-sm font-medium text-foreground">Chat</h2>
              <button onClick={togglePanel} className="text-muted-foreground hover:text-foreground">
              <Minus className="w-4 h-4" />
              </button>
          </div>

          <div className="flex flex-wrap gap-2 px-3 pt-2">
              <Button
                  size="sm"
                  variant="outline"
                  className="basis-[48%] max-w-[48%]"
                  onClick={() => handleQuickButton("troubleshoot")}
              >
                  Troubleshooting
              </Button>
              <Button
                  size="sm"
                  variant="outline"
                  className="basis-[48%] max-w-[48%]"
                  onClick={() => handleQuickButton("email")}
              >
                  Automatic Emails
              </Button>
              <Button
                  size="sm"
                  variant="outline"
                  className="basis-[48%] max-w-[48%]"
                  onClick={() => handleQuickButton("help")}
              >
                  FAQs & Help
              </Button>

              {learnMode && (
              <Button
                size="sm"
                variant="outline"
                className="basis-[48%] max-w-[48%]"
                onClick={startQuiz}
              >
                Take Quiz
              </Button>
            )}
          </div>           
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {messages
          .filter((msg) => msg.text.trim() !== "")
          .map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`px-3 py-2 rounded-lg max-w-[70%] whitespace-pre-wrap break-words ${
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted text-muted-foreground rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t flex items-center gap-2">
          <input
            type="text"
            className="flex-1 border border-input rounded px-2 py-1 text-sm bg-card text-foreground placeholder:text-muted-foreground"
            placeholder={
              quizActive
                ? "Answer with A/B/C/D or full text…"
                : "Type your message..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />
          <Button size="sm" onClick={sendMessage}>
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-16 right-8 z-50">
        {!isOpen && (
          <Button
            variant="secondary"
            className="rounded-full p-3 shadow-lg"
            onClick={togglePanel}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 h-96 bg-card shadow-xl border rounded-lg z-50 flex flex-col">
          <div className="flex flex-col border-b">
            <div className="flex items-center justify-between p-3 border-b">
                <h2 className="text-sm font-medium text-foreground">Chat</h2>
                <button onClick={togglePanel} className="text-muted-foreground hover:text-foreground">
                <Minus className="w-4 h-4" />
                </button>
            </div>

            <div className="flex flex-wrap gap-2 px-3 pt-2">
                <Button
                    size="sm"
                    variant="outline"
                    className="basis-[48%] max-w-[48%]"
                    onClick={() => handleQuickButton("troubleshoot")}
                >
                    Troubleshooting
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="basis-[48%] max-w-[48%]"
                    onClick={() => handleQuickButton("email")}
                >
                    Automatic Emails
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="basis-[48%] max-w-[48%]"
                    onClick={() => handleQuickButton("help")}
                >
                    FAQs & Help
                </Button>

                {learnMode && (
                <Button
                  size="sm"
                  variant="outline"
                  className="basis-[48%] max-w-[48%]"
                  onClick={startQuiz}
                >
                  Take Quiz
                </Button>
              )}
            </div>           
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
          {messages
            .filter((msg) => msg.text.trim() !== "")
            .map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-3 py-2 rounded-lg max-w-[70%] whitespace-pre-wrap break-words ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-muted-foreground rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t flex items-center gap-2">
            <input
              type="text"
              className="flex-1 border border-input rounded px-2 py-1 text-sm bg-card text-foreground placeholder:text-muted-foreground"
              placeholder={
                quizActive
                  ? "Answer with A/B/C/D or full text…"
                  : "Type your message..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />
            <Button size="sm" onClick={sendMessage}>
              Send
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import { useChat } from "ai/react";
import { Message } from "ai";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import PromptSuggestionsRow from "./components/PromptSuggestionsRow";

import "bootstrap/dist/css/bootstrap.min.css";
import ExampleData from "./components/DataInfo";
import { useState } from "react";
import Button from "react-bootstrap/Button";

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
}

const Home = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // const {
  //   append,
  //   isLoading,
  //   input,
  //   messages,
  //   handleInputChange,
  //   handleSubmit,
  // } = useChat();

  const noMessages = !messages || messages.length === 0;

  // const handlePromptClick = (promptText) => {
  //   const msg: Message = {
  //     id: crypto.randomUUID(),
  //     content: promptText,
  //     role: "user",
  //   };
  //   append(msg);
  // };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // console.log("users question ===>", e.target.value);
    setQuestion(e.target.value);
  }

  const handleCustomSubmit = async (e: React.FormEvent) => {
    // console.log("payload =>", question);

    e.preventDefault();
    if (!question.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: question,
      role: "user",
    }

    setMessages((prevMsg) => [...prevMsg, userMessage]);
    setIsLoading(true);
    setQuestion('');

    try {
      const response = await fetch(`/api/sql-chat?question=${encodeURIComponent(question)}`);
      const data = await response.json();
      // console.log("response from API ==>", response);
      // console.log("API Response:", data);

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: data?.message,
        role: "assistant",
      };
      setMessages((prevMsg) => [...prevMsg, botMessage]);

      // console.log("messages ===>", messages);
    } catch (error) {
      console.error("Error fetching API:", error);
    } finally {
      setIsLoading(false);
    }
    // handleSubmit(e);
    // await fetch("http://localhost:3000/api/sql-chat");
  };

  const handleFileSearch = async () => {
    try {
      await fetch("http://localhost:3000/api/file-search");
    } catch (error) {
      console.log("Error from file search:", error)
    }
  }

  return (
    <main className="d-flex gap-3">
      {/* <Image src={chessLogo} width="140" height="100" alt="F1 Logo" /> */}
      <div className="d-flex gap-3">
        <ExampleData />
        <Button variant="link" onClick={handleFileSearch} size="sm">
          Create File Assistant
        </Button>
      </div>
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <br />
            {/* <PromptSuggestionsRow onPromptClick={handlePromptClick} /> */}
          </>
        ) : (
          <>
            {messages?.map((message, index) => (
              <Bubble key={`message-${index}`} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>

      <form onSubmit={(e) => handleCustomSubmit(e)}>
        <input
          type="text"
          className="question-box"
          onChange={(e) => handleCustomInput(e)}
          value={question}
          placeholder="Ask me anything..."
        />
        <input type="submit" className="" />
      </form>
    </main>
  );
};

export default Home;

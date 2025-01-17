"use client";
import { useChat } from "ai/react";
import { Message } from "ai";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import PromptSuggestionsRow from "./components/PromptSuggestionsRow";

import "bootstrap/dist/css/bootstrap.min.css";
import ExampleData from "./components/DataInfo";

const Home = () => {
  const {
    append,
    isLoading,
    input,
    messages,
    handleInputChange,
    handleSubmit,
  } = useChat();

  const noMessages = !messages || messages.length === 0;

  const handlePromptClick = (promptText) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: "user",
    };
    append(msg);
  };

  return (
    <main className="d-flex gap-3">
      {/* <Image src={chessLogo} width="140" height="100" alt="F1 Logo" /> */}
      <div className="d-flex gap-3">
        
        <ExampleData />
      </div>
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <br />
            <PromptSuggestionsRow onPromptClick={handlePromptClick} />
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

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="question-box"
          onChange={handleInputChange}
          value={input}
          placeholder="Ask me anything..."
        />
        <input type="submit" className="" />
      </form>
    </main>
  );
};

export default Home;

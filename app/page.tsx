"use client";
import Image from "next/image";
import chessLogo from "./assets/chess-logo.jpg";
import { useChat } from "ai/react";
import { Message } from "ai";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import PromptSuggestionsRow from "./components/PromptSuggestionsRow";
import { useState } from "react";
import InfoModel from "./components/InfoModel";
import data from "../scripts/Product.json";

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
    <main>
      {/* <Image src={chessLogo} width="140" height="100" alt="F1 Logo" /> */}
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            {/* <p className="started-text"> */}
              <div>
                Sample Products data:
                <table style={{}}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Discount</th>
                      <th>Quantity</th>
                      <th>Description</th>
                      <th>Rating</th>
                      <th>Brand</th>
                      {/* <th>SKU</th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.name}</td>
                        <td>{item.category}</td>
                        <td>${item.price}</td>
                        <td>{item.discount}%</td>
                        <td>{item.quantity}</td>
                        <td>{item.description}</td>
                        <td>{item.rating}</td>
                        <td>{item.brand}</td>
                        {/* <td>{item.sku}</td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

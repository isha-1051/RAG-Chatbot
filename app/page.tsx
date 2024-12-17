'use client'
import Image from 'next/image';
import chessLogo from './assets/chess-logo.jpg';
import { useChat } from 'ai/react';
import { Message } from 'ai'
import Bubble from './components/Bubble';
import LoadingBubble from './components/LoadingBubble';
import PromptSuggestionsRow from './components/PromptSuggestionsRow';

const Home = () => {
  const { append, isLoading, input, messages, handleInputChange, handleSubmit } = useChat();

  const noMessages = !messages || messages.length === 0;

  const handlePromptClick = (promptText) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: 'user'
    };
    append(msg);
  };

  return (
    <main>
      <Image src={chessLogo} width='140' height='140' alt='F1 Logo' />
      <section className={noMessages ? '' : 'populated'}>
        {noMessages ? (
          <>
            <p className='started-text'>
            Welcome to the Ultimate Chess Championship Chatbot! Whether you're a devoted chess enthusiast or just stepping into the world of the 64 squares, I’m here to answer all your questions. Explore the strategies, and thrilling moments from the Chess World Championship-just ask away!
            </p>
            <br />
            <PromptSuggestionsRow onPromptClick={handlePromptClick} />
          </>
        ) : (
          <>
            {messages?.map((message, index) => <Bubble key={`message-${index}`} message={message} />)}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>
      <form onSubmit={handleSubmit}>
        <input type="text" className='question-box' onChange={handleInputChange} value={input} placeholder='Ask me anything...' />
        <input type="submit" className='' />
      </form>
    </main>
  )
};

export default Home;

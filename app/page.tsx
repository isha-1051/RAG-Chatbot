'use client'
import Image from 'next/image';
import f1logo from './assets/f1_logo.png';
import { useChat } from 'ai/react';
import { Message } from 'ai'
import Bubble from './components/Bubble';
import LoadingBubble from './components/LoadingBubble';
import PromptSuggestionsRow from './components/PromptSuggestionsRow';

const Home = () => {
  const { append, isLoading, input, messages, handleInputChange, handleSubmit } = useChat();

  const noMessages = !messages || messages.length === 0;

  const handlePromptClick = ({ promptText }) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: 'user'
    };
    append(msg);
  };

  return (
    <main>
      <Image src={f1logo} width='140' height='30' alt='F1 Logo' />
      <section className={noMessages ? '' : 'populated'}>
        {noMessages ? (
          <>
            <p className='started-text'>
            Welcome to the Ultimate F1 Chatbot! Whether you&apos;re a die-hard Formula 1 fan or just getting into the sport, I’m here to answer all your questions. Dive into the world of high-speed action, and thrilling rivalries—just ask away!
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

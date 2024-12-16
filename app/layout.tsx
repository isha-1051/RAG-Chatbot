import './global.css';

export const metaData = {
  title: "RAG_Chatbot",
  description: "One stop place for all Formula One questions."
};

const RootLayout = ({ children }) => { 
  return (
    <>
      <html lang='en'>
        <body>
          {children}
        </body>
      </html>
    </>
  )
};

export default RootLayout;

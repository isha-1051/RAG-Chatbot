import 'bootstrap/dist/css/bootstrap.min.css';
import './global.css';


import type { Metadata } from 'next'
 
export const metadata: Metadata = {
  title: 'World Chess Championship ChatBot',
  description: 'Ask anything about World Chess Championship.',
}

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

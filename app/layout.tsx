import 'bootstrap/dist/css/bootstrap.min.css';
import './global.css';


import type { Metadata } from 'next'
 
export const metadata: Metadata = {
  title: 'Product Info',
  description: 'Ask anything about any product.',
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

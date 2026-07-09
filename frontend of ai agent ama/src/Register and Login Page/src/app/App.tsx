import { RouterProvider } from 'react-router';
import { router } from './routes';

// Prevent black flash globally
const globalStyle = document.createElement('style');
globalStyle.innerHTML = `
  html, body, #root {
    background: #0d0f1a !important;
    margin: 0;
    padding: 0;
  }
`;
document.head.appendChild(globalStyle);

export default function App() {
  return (
    <RouterProvider router={router} />
  );
}
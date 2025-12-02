import "../styles/globals.css";
import { Toaster } from "react-hot-toast";

export default function App({ Component, pageProps }) {
  return (
    <>
      {/* Toast container (must be at root) */}
      <Toaster position="top-right" reverseOrder={false} />

      {/* Your actual page */}
      <Component {...pageProps} />
    </>
  );
}

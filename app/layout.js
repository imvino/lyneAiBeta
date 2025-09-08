export const metadata = {
  title: 'Lyneports ChatBot',
  description: 'Your aviation design co-pilot',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Segoe UI, Roboto, sans-serif",
          background: "linear-gradient(to bottom, #87ceeb, #f0f9ff)",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        {children}
      </body>
    </html>
  )
}

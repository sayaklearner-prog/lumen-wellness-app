import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no"
        />
        <title>Lumen OS</title>
        <meta name="theme-color" content="#050b08" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                height: 100%;
                background-color: #050b08;
                user-select: none;
                -webkit-user-select: none;
                touch-action: manipulation;
                overscroll-behavior: none;
              }
              body {
                overflow: hidden;
              }
              #root {
                display: flex;
                height: 100%;
                flex: 1;
                background-color: #050b08;
              }
            `,
          }}
        />
      </head>
      <body style={{ backgroundColor: '#050b08' }}>{children}</body>
    </html>
  );
}

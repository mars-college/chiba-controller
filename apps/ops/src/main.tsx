import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles.css'

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily:
    'Alegreya Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily: 'Oxanium, Alegreya Sans, ui-sans-serif, system-ui',
  },
})

const routerBasePath = (() => {
  const baseUrl = import.meta.env.BASE_URL || '/'
  if (baseUrl.length > 1 && baseUrl.endsWith('/')) {
    return baseUrl.slice(0, -1)
  }
  return baseUrl
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasePath}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications position="top-right" />
        <App />
      </MantineProvider>
    </BrowserRouter>
  </StrictMode>,
)

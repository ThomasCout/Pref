import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Card } from '@heroui/react'
import './index.css'

function App() {
  return (
    <div id="app">
      <Card className="m-6"><Card.Content>
        <h1 className="text-2xl font-bold">L'apPréfet</h1>
        <Button className="mt-4">Test HeroUI</Button>
      </Card.Content></Card>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

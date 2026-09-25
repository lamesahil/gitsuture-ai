import { useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import HealingTimeline, { type HealingTimelineRef } from './components/HealingTimeline'
import HowItWorks from './components/HowItWorks'
import Differentiators from './components/Differentiators'
import DiffSection from './components/DiffSection'
import SecuritySection from './components/SecuritySection'
import CTASection from './components/CTASection'
import Footer from './components/Footer'
import Dashboard from './components/Dashboard'
import Scene from './components/Scene'

export default function App() {
  const timelineRef = useRef<HealingTimelineRef | null>(null)
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing')

  return (
    <div style={{ background: 'transparent', minHeight: '100svh' }} className="relative">
      <Scene />
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {/* Push content below fixed navbar */}
      <main style={{ paddingTop: '64px' }}>
        {currentView === 'landing' ? (
          <>
            <Hero />
            <HealingTimeline timelineRef={timelineRef} />
            <HowItWorks />
            <Differentiators />
            <DiffSection />
            <SecuritySection />
            <CTASection />
          </>
        ) : (
          <Dashboard />
        )}
      </main>

      {/* Footer is hidden in Dashboard mode — the panel fills the full viewport */}
      {currentView === 'landing' && <Footer />}
    </div>
  )
}

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

export default function App() {
  const timelineRef = useRef<HealingTimelineRef | null>(null)
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing')

  function scrollToDemo() {
    const el = document.getElementById('interactive-demo')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Start the auto-cycle when user scrolls to demo
      timelineRef.current?.startAutoCycle()
    }
  }

  return (
    <div style={{ background: '#080f17', minHeight: '100svh' }}>
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {/* Push content below fixed navbar */}
      <main style={{ paddingTop: '64px' }}>
        {currentView === 'landing' ? (
          <>
            <Hero onScrollToDemo={scrollToDemo} />
            <HealingTimeline timelineRef={timelineRef} />
            <HowItWorks />
            <Differentiators />
            <DiffSection />
            <SecuritySection />
            <CTASection onScrollToDemo={scrollToDemo} />
          </>
        ) : (
          <Dashboard />
        )}
      </main>

      <Footer />
    </div>
  )
}

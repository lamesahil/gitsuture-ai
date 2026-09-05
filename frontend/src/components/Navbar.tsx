import { useEffect, useRef, useState } from 'react'

const NAV_LINKS = [
  { label: 'Product', href: '#hero' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Architecture', href: '#differentiators' },
  { label: 'GitHub', href: '#cta' },
]

export default function Navbar({
  currentView = 'landing',
  setCurrentView,
}: {
  currentView?: 'landing' | 'dashboard'
  setCurrentView?: (v: 'landing' | 'dashboard') => void
}) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }
    if (mobileOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileOpen])

  function handleNavClick(href: string) {
    setMobileOpen(false)
    if (setCurrentView && currentView !== 'landing') {
      setCurrentView('landing')
      setTimeout(() => {
        const el = document.querySelector(href)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else {
      const el = document.querySelector(href)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-shadow duration-300 ${
        scrolled
          ? 'shadow-[0_1px_8px_rgba(0,0,0,0.5)]'
          : 'shadow-[0_1px_0_rgba(255,255,255,0.04)]'
      }`}
      style={{
        background: 'rgba(8,15,23,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="h-16 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between gap-3">
        {/* Logo + Nav */}
        <div className="flex items-center gap-6">
          <a
            href="#hero"
            onClick={(e) => { e.preventDefault(); handleNavClick('#hero') }}
            className="flex items-center gap-2 group"
            aria-label="GitSuture home"
          >
            {/* Logo SVG mark */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#06b6d4" fillOpacity="0.15" />
              <path
                d="M9 14c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5"
                stroke="#06b6d4"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M14 9V7M14 21v-2"
                stroke="#4edea3"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="14" cy="14" r="2" fill="#06b6d4" />
            </svg>
            <span
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 500, letterSpacing: '-0.01em' }}
              className="text-[#dce3f0] tracking-tight"
            >
              GitSuture
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => { e.preventDefault(); handleNavClick(link.href) }}
                className="transition-colors text-[13px] text-[#bcc9cd] hover:text-[#dce3f0]"
                style={{ lineHeight: '18px' }}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => {
                setMobileOpen(false)
                setCurrentView?.('dashboard')
              }}
              className={`transition-colors text-[13px] hover:text-[#dce3f0] ${currentView === 'dashboard' ? 'text-[#dce3f0] font-medium' : 'text-[#bcc9cd]'}`}
              style={{ lineHeight: '18px' }}
            >
              Dashboard
            </button>
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <a
            href="#cta"
            onClick={(e) => { e.preventDefault(); handleNavClick('#cta') }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[15px] font-medium transition-all active:scale-[0.98] hover:brightness-110"
            style={{
              background: '#06b6d4',
              color: '#00424f',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.01em',
              lineHeight: '22px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>Install GitHub App</span>
          </a>

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-btn"
            className="md:hidden flex flex-col items-center justify-center w-8 h-8 gap-1.5 rounded"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <span
              className={`block h-0.5 w-5 bg-[#bcc9cd] transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`}
            />
            <span
              className={`block h-0.5 w-5 bg-[#bcc9cd] transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`}
            />
            <span
              className={`block h-0.5 w-5 bg-[#bcc9cd] transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          ref={menuRef}
          className="md:hidden border-t px-6 py-4 flex flex-col gap-3"
          style={{ borderColor: '#3d494c', background: 'rgba(8,15,23,0.97)' }}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); handleNavClick(link.href) }}
              className="text-[14px] text-[#bcc9cd] hover:text-[#dce3f0] transition-colors py-1"
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={() => {
              setMobileOpen(false)
              setCurrentView?.('dashboard')
            }}
            className={`text-left text-[14px] hover:text-[#dce3f0] transition-colors py-1 ${currentView === 'dashboard' ? 'text-[#dce3f0] font-medium' : 'text-[#bcc9cd]'}`}
          >
            Dashboard
          </button>
          <a
            href="#cta"
            onClick={(e) => { e.preventDefault(); handleNavClick('#cta') }}
            className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-[14px] font-medium transition-all"
            style={{ background: '#06b6d4', color: '#00424f' }}
          >
            Install GitHub App
          </a>
        </div>
      )}
    </header>
  )
}

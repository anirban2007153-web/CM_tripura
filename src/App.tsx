import { ArrowDown, ArrowUpRight, Leaf, MapPin, Sprout } from 'lucide-react';

const ideas = [
  {
    number: '01',
    title: 'Notice what is happening',
    description: 'Make it easier for neighbors to describe a cleanliness concern and where it is happening.',
    icon: MapPin,
  },
  {
    number: '02',
    title: 'Understand the bigger picture',
    description: 'Bring local observations together so recurring patterns are easier to see.',
    icon: Sprout,
  },
  {
    number: '03',
    title: 'See how places change',
    description: 'Keep a clear record of updates and community progress over time.',
    icon: Leaf,
  },
];

function MapIllustration() {
  return (
    <div aria-label="Illustration of a neighborhood map with location markers" className="map-card" role="img">
      <div className="map-toolbar"><span className="map-dot" /><span>TRIPURA · COMMUNITY VIEW</span><span className="map-menu">•••</span></div>
      <div className="map-canvas">
        <span className="map-label map-label-one">AGARTALA</span>
        <span className="map-label map-label-two">NEIGHBORHOOD</span>
        <span className="map-road map-road-one" />
        <span className="map-road map-road-two" />
        <span className="map-road map-road-three" />
        <span className="map-green map-green-one" />
        <span className="map-green map-green-two" />
        <span className="map-pin map-pin-one"><MapPin size={18} strokeWidth={2.5} /></span>
        <span className="map-pin map-pin-two"><MapPin size={18} strokeWidth={2.5} /></span>
        <span className="map-pin map-pin-three"><MapPin size={18} strokeWidth={2.5} /></span>
      </div>
      <div className="map-caption"><span className="caption-icon"><Leaf size={16} /></span><span><strong>A clearer local picture</strong><small>An idea for seeing what matters, street by street.</small></span><ArrowUpRight aria-hidden="true" className="caption-arrow" size={18} /></div>
    </div>
  );
}

export default function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a aria-label="CleanMap Tripura home" className="brand" href="#top">
          <span className="brand-mark"><Leaf aria-hidden="true" size={19} strokeWidth={2.2} /></span>
          <span>cleanmap<span className="brand-place">tripura</span></span>
        </a>
        <nav aria-label="Main navigation" className="desktop-nav">
          <a href="#idea">The idea</a>
          <a href="#how-it-works">How it could work</a>
          <a className="nav-cta" href="#how-it-works">Explore the idea <ArrowUpRight aria-hidden="true" size={15} /></a>
        </nav>
        <a aria-label="Explore how CleanMap could work" className="mobile-cta" href="#how-it-works"><ArrowUpRight size={18} /></a>
      </header>

      <main id="top">
        <section aria-labelledby="hero-title" className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" />A community idea for Tripura</p>
            <h1 id="hero-title">Cleaner streets start with a <span>clearer picture.</span></h1>
            <p className="hero-description">CleanMap is a simple idea: help communities notice local cleanliness concerns, understand where they happen, and see how places change over time.</p>
            <a className="primary-cta" href="#how-it-works">See how it could work <ArrowUpRight aria-hidden="true" size={17} /></a>
            <a className="scroll-cue" href="#idea"><span>Scroll to explore</span><ArrowDown aria-hidden="true" size={15} /></a>
          </div>
          <div className="hero-visual"><div aria-hidden="true" className="visual-orbit orbit-one" /><div aria-hidden="true" className="visual-orbit orbit-two" /><MapIllustration /><span className="visual-note">SMALL OBSERVATIONS. SHARED UNDERSTANDING.</span></div>
        </section>

        <section aria-labelledby="idea-title" className="idea-section section-wrap" id="idea">
          <div className="section-heading">
            <p className="eyebrow"><span className="eyebrow-line" />The idea</p>
            <h2 id="idea-title">A better view of the places we share.</h2>
          </div>
          <p className="idea-intro">CleanMap imagines a thoughtful, neighborhood-level way to share what people see around them. The goal is to make local information easier to understand and act on together.</p>
        </section>

        <section aria-labelledby="steps-title" className="steps-section section-wrap" id="how-it-works">
          <div className="steps-heading"><div><p className="eyebrow"><span className="eyebrow-line" />A simple starting point</p><h2 id="steps-title">How it could work</h2></div><p>Three small steps toward a clearer community picture.</p></div>
          <div className="idea-grid">
            {ideas.map(({ number, title, description, icon: Icon }) => (
              <article className="idea-card" key={number}>
                <div className="card-top"><span className="card-number">{number}</span><span className="card-icon"><Icon aria-hidden="true" size={20} strokeWidth={1.8} /></span></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span aria-hidden="true" className="card-rule" />
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="closing-title" className="closing-section section-wrap">
          <div className="closing-panel"><span aria-hidden="true" className="closing-mark"><Leaf size={21} /></span><div><p className="eyebrow">A cleaner future, together</p><h2 id="closing-title">Good ideas begin with paying attention.</h2></div><a aria-label="Back to top" className="closing-link" href="#top"><ArrowUpRight size={20} /></a></div>
        </section>
      </main>

      <footer className="site-footer section-wrap"><a aria-label="CleanMap Tripura home" className="brand footer-brand" href="#top"><span className="brand-mark"><Leaf aria-hidden="true" size={17} /></span><span>cleanmap<span className="brand-place">tripura</span></span></a><p>An independent concept prototype. Not an official government service.</p><a className="back-top" href="#top">Back to top ↑</a></footer>
    </div>
  );
}


import { IMAGES, type ProjectId } from '../data'

export function BelowFold({ onOpenProject, onOpenCarousel }: {
  onOpenProject: (id: ProjectId, trigger: HTMLElement) => void
  onOpenCarousel: () => void
}) {
  return (
    <section id="below-fold">
      <div className="section-row">
        <div className="panel" id="contact-panel">
          <h3 className="bodoni">CONTACT</h3>
          <div className="contact-links">
            <a href="mailto:caroline.ehrngren@gmail.com">Email: caroline.ehrngren@gmail.com</a>
            <a href="https://www.linkedin.com/in/caroline-ehrngren-85a6621b5" target="_blank" rel="noopener">
              LinkedIn: Caroline Ehrngren
            </a>
          </div>

          <button
            type="button"
            className="scallop-frame"
            id="cvmap-plaque"
            onClick={(e) => onOpenProject('cvmindmap', e.currentTarget)}
            aria-label="Open CV and Mindmap"
          >
            <img src={IMAGES.cvPlaque} alt="" width={700} height={426} draggable={false} />
          </button>
        </div>

        <button type="button" id="carousel-panel" onClick={onOpenCarousel} aria-label="Open Caroline's Social Carousel">
          <div className="mini-carousel-wrap">
            <img src={IMAGES.socialCarousel} alt="" width={640} height={508} draggable={false} />
            <div className="cap bodoni">Caroline's<br />Social Carousel</div>
          </div>
        </button>
      </div>

      <footer className="site-footer bodoni">CAROLINE EHRNGREN &nbsp;·&nbsp; STOCKHOLM &amp; PARIS</footer>
    </section>
  )
}

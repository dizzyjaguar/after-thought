import icon from "../../assets/icon.png";
import screenshot from "../../assets/screenshot.png";
import { CallScene } from "./CallScene";

const REPO = "https://github.com/dizzyjaguar/after-thought";

export function App() {
  return (
    <div className="page">
      <div className="glow glow-violet" aria-hidden />
      <div className="glow glow-blue" aria-hidden />

      <div className="nav-bar">
        <nav className="nav">
          <a className="brand" href="#">
            {/* The app icon's sparkle (assets/icon.svg), plain white like in the menu bar. */}
            <svg className="brand-mark" viewBox="262 262 500 500" width="20" height="20" aria-hidden>
              <path
                d="M512 262 C 532 440, 584 492, 762 512 C 584 532, 532 584, 512 762 C 492 584, 440 532, 262 512 C 440 492, 492 440, 512 262 Z"
                fill="currentColor"
              />
            </svg>
            After Thought
          </a>
          <a className="button ghost small" href={REPO}>
            GitHub
          </a>
        </nav>
      </div>

      <div className="container">

        <header className="hero">
          <img className="hero-icon" src={icon} alt="After Thought app icon" width={112} height={112} />
          <h1>Catch the thought before it’s gone.</h1>
          <p className="lead">
            Open-source quick notes for productive people. Press <kbd>⌘⇧Space</kbd> anywhere and your
            last note is there, ready to type.
          </p>
          <div className="actions">
            <a className="button primary" href={REPO}>
              View on GitHub
            </a>
            <a className="button ghost" href="#beta">
              Try the beta
            </a>
          </div>
          <p className="meta">Beta · Free and open source · MIT license · macOS 26</p>
        </header>

        <img
          className="screenshot"
          src={screenshot}
          alt="After Thought window with a sidebar of folders and a note with a checklist"
        />

        <section className="split">
          <div className="split-text">
            <p className="eyebrow">Made for calls and deep work</p>
            <h2>Stays open. Stays out of the way.</h2>
            <p className="body">
              Your notes float above everything else, so they’re right there during a call. Click back
              into the meeting and they fade, so you can still see who’s talking.
            </p>
            <ul className="levels">
              <li>
                <span className="level l100">100%</span>Typing in your note
              </li>
              <li>
                <span className="level l80">80%</span>Mouse over it
              </li>
              <li>
                <span className="level l65">65%</span>Clicked away
              </li>
            </ul>
          </div>
          <div className="split-scene">
            <CallScene />
          </div>
        </section>

        <section className="features">
          <h2>Everything a quick note needs</h2>
          <div className="feature-grid">
            <article className="feature">
              <div className="feature-art" aria-hidden>
                <div className="keys">
                  <span className="key">⌘</span>
                  <span className="key">⇧</span>
                  <span className="key wide">space</span>
                </div>
              </div>
              <h3>One shortcut</h3>
              <p>⌘⇧Space opens your last note from anywhere. Press it again to hide.</p>
            </article>

            <article className="feature">
              <div className="feature-art" aria-hidden>
                <div className="slash-menu">
                  <div className="slash">/</div>
                  <div className="slash-item active">
                    <span className="slash-icon h1">H1</span>Heading
                  </div>
                  <div className="slash-item">
                    <span className="slash-icon">
                      <svg viewBox="0 0 16 16" width="15" height="15">
                        <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M5 8.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Checklist
                  </div>
                  <div className="slash-item">
                    <span className="slash-icon mono">&lt;/&gt;</span>Code
                  </div>
                </div>
              </div>
              <h3>Notion-style blocks</h3>
              <p>Type / for headings, checklists, lists, quotes and code.</p>
            </article>

            <article className="feature">
              <div className="feature-art" aria-hidden>
                <div className="handoff">
                  <div className="file-chip">
                    <svg viewBox="0 0 16 16" width="18" height="18">
                      <path d="M4 2.5h5.5L12.5 5.5v8H4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                      <path d="M6 8h4.5M6 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    Morning standup.md
                  </div>
                  <div className="paste">
                    <svg viewBox="0 0 16 16" width="14" height="14">
                      <path d="M8 2l1.3 4.7L14 8l-4.7 1.3L8 14l-1.3-4.7L2 8l4.7-1.3z" fill="currentColor" />
                    </svg>
                    Copy for Claude
                  </div>
                </div>
              </div>
              <h3>Handoff to Claude</h3>
              <p>Right-click a note or a whole folder and paste it into Claude as a clean .md attachment.</p>
            </article>
          </div>
        </section>

        <section className="beta" id="beta">
          <span className="badge">
            <span className="dot" />
            Currently in beta
          </span>
          <h2>Help shape After Thought</h2>
          <p className="body">
            It’s early, and there’s no download yet. Build it from source to try it on macOS 26, tell us
            what breaks, or send a pull request.
          </p>
          <div className="actions">
            <a className="button primary" href={`${REPO}#install`}>
              Try the beta
            </a>
            <a className="button ghost" href={`${REPO}/issues`}>
              Report a bug
            </a>
            <a className="button ghost" href={`${REPO}/pulls`}>
              Contribute
            </a>
          </div>
        </section>

        <footer className="footer">
          <span>After Thought · MIT license</span>
          <span>
            Editor by <a href="https://www.blocknotejs.org">BlockNote</a> · <a href={REPO}>Source on GitHub</a>
          </span>
        </footer>
      </div>
    </div>
  );
}

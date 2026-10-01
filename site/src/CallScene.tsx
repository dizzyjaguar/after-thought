import windowShot from "../../assets/window-standup.png";
import type { FadePhase } from "./motion";

const people = [
  { initials: "MA", name: "Maya", tile: "#2b3747", avatar: "#4f6b8c" },
  { initials: "JO", name: "Jordan", tile: "#382e44", avatar: "#6a5487" },
  { initials: "PR", name: "Priya", tile: "#2c4137", avatar: "#4e7c66" },
  { initials: "SA", name: "Sam (you)", tile: "#44352a", avatar: "#8a6649" },
];

const LABELS: Record<FadePhase, string> = {
  away: "Clicked back into the call: notes fade to 65%",
  hover: "Mouse over the notes: 80%",
  focus: "Clicked in to type: 100%",
};

/** A made-up video call with After Thought floating on top, acting out the fade levels. */
export function CallScene({ phase }: { phase: FadePhase }) {
  return (
    <figure className={`scene phase-${phase}`}>
      <div className="scene-glow a" aria-hidden />
      <div className="scene-glow b" aria-hidden />
      <div className="scene-glow c" aria-hidden />

      <div className="call" aria-hidden>
        <div className="call-bar">
          <span className="light" />
          <span className="light" />
          <span className="light" />
          <span className="call-title">Morning standup</span>
        </div>
        <div className="call-grid">
          {people.map((p, i) => (
            <div key={p.name} className="tile" style={{ background: p.tile }}>
              <span
                className={`avatar ${i === 1 ? "speaking" : ""}`}
                style={{ background: p.avatar }}
              >
                {p.initials}
              </span>
              <span className="name">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="call-controls">
          <span className="ctrl" />
          <span className="ctrl" />
          <span className="ctrl leave" />
        </div>
      </div>

      <img
        className="scene-notes"
        src={windowShot}
        alt="After Thought open on a Morning standup note, floating over a video call"
      />

      {/* A pretend mouse pointer that acts out using the app. */}
      <div className="cursor" aria-hidden>
        {phase !== "hover" && <span key={phase} className="click-ring" />}
        <svg viewBox="0 0 20 20" width="20" height="20">
          <path d="M4 2l11 9.5-5 .6 3 5.6-2.2 1.1-3-5.6L4 17z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </div>

      <figcaption className="scene-label" aria-live="off">
        <span className="dot" />
        {LABELS[phase]}
      </figcaption>
    </figure>
  );
}

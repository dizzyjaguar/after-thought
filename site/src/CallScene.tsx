import windowShot from "../../assets/window-standup.png";

const people = [
  { initials: "MA", name: "Maya", tile: "#2b3747", avatar: "#4f6b8c" },
  { initials: "JO", name: "Jordan", tile: "#382e44", avatar: "#6a5487" },
  { initials: "PR", name: "Priya", tile: "#2c4137", avatar: "#4e7c66" },
  { initials: "SA", name: "Sam (you)", tile: "#44352a", avatar: "#8a6649" },
];

/** A made-up video call with After Thought floating on top, faded. */
export function CallScene() {
  return (
    <figure className="scene">
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
          {people.map((p) => (
            <div key={p.name} className="tile" style={{ background: p.tile }}>
              <span className="avatar" style={{ background: p.avatar }}>
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
        alt="After Thought open on a Morning standup note, faded over a video call"
      />
      <figcaption className="scene-label">
        <span className="dot" />
        Clicked back into the call: notes fade to 65%
      </figcaption>
    </figure>
  );
}

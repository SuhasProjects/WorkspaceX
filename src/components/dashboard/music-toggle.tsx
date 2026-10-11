"use client";

import { useRef, useState } from "react";
import { Icon } from "./icon";

const VIDEO_ID = "lsS-ltvo8T0";

export function MusicToggle() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [origin, setOrigin] = useState("");
  const playerRef = useRef<HTMLIFrameElement>(null);

  function toggleMusic() {
    if (!playing) {
      setOrigin(window.location.origin);
      setMuted(false);
      setPlaying(true);
      return;
    }

    const nextMuted = !muted;
    setMuted(nextMuted);
    playerRef.current?.contentWindow?.postMessage(JSON.stringify({
      event: "command",
      func: nextMuted ? "mute" : "unMute",
      args: [],
    }), "https://www.youtube-nocookie.com");
  }

  function closePlayer() {
    setPlaying(false);
    setMuted(false);
  }

  const label = !playing ? "Play music" : muted ? "Unmute music" : "Mute music";

  return <div className="music-control">
    <button type="button" className="icon-button music-toggle" aria-label={label} title={label} aria-pressed={playing && !muted} onClick={toggleMusic}>
      <Icon name={!playing ? "play" : muted ? "musicOff" : "music"} />
    </button>
    {playing && <div className="music-player-popover" role="region" aria-label="Music player">
      <div className="music-player-heading"><span>Workspace music</span><button type="button" className="music-player-close" aria-label="Stop music and close player" onClick={closePlayer}><Icon name="close" size={15} /></button></div>
      <iframe
        ref={playerRef}
        className="music-player-frame"
        title="Copyright Free Lofi Mix on YouTube"
        width="320"
        height="200"
        src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&controls=1&enablejsapi=1&origin=${encodeURIComponent(origin)}&rel=0`}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <a className="music-player-source" href={`https://www.youtube.com/watch?v=${VIDEO_ID}`} target="_blank" rel="noreferrer">Open video on YouTube</a>
    </div>}
  </div>;
}

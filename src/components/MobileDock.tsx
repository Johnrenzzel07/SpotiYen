import { usePlayer } from "../context/PlayerContext";
import { NavTabs } from "./BottomNav";
import { MobileNowPlaying } from "./NowPlayingBar";

export default function MobileDock() {
  const { currentTrack } = usePlayer();

  return (
    <div
      data-player-bar
      className="md:hidden fixed inset-x-0 bottom-0 z-50 overflow-visible"
      style={{
        background: "white",
        borderRadius: "28px 28px 0 0",
        boxShadow:
          "0 -12px 32px rgba(58, 47, 69, 0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      {currentTrack && (
        <>
          <MobileNowPlaying />
          <div
            className="mx-5"
            style={{ height: 1, background: "rgba(58, 47, 69, 0.08)" }}
          />
        </>
      )}
      <NavTabs />
    </div>
  );
}

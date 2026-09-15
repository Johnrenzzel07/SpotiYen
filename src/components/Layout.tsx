import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import MobileDock from "./MobileDock";
import NowPlayingBar from "./NowPlayingBar";
import LyricsKaraoke from "./LyricsKaraoke";
import MobileHeader from "./MobileHeader";
import Toast from "./Toast";
import { useTracks } from "../context/TrackContext";
import { usePlayer } from "../context/PlayerContext";

export default function Layout() {
  const location = useLocation();
  const { newTrackToast, dismissToast, tracks, loading } = useTracks();
  const { play, currentTrack, stop } = usePlayer();
  const hasPlayer = Boolean(currentTrack);

  useEffect(() => {
    if (currentTrack && !loading && !tracks.some((t) => t.id === currentTrack.id)) {
      stop();
    }
  }, [currentTrack, tracks, loading, stop]);

  return (
    <div className="clay-bg h-dvh md:min-h-screen md:h-auto overflow-hidden md:overflow-visible flex flex-col md:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <MobileHeader />
        <main
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden md:pb-28 ${
            hasPlayer
              ? "pb-[calc(12.5rem+env(safe-area-inset-bottom))]"
              : "pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
          }`}
        >
          <div key={location.pathname} className="animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>

      <NowPlayingBar />
      <MobileDock />
      <LyricsKaraoke />

      {newTrackToast && (
        <Toast
          track={newTrackToast}
          onPlay={() => {
            play(newTrackToast, tracks);
            dismissToast();
          }}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}

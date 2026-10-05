import React, { useState, useEffect } from "react";

export default function SplashScreen({
  startFetch,
  minDuration = 800,
  onFinish,
}) {
  const [render, setRender] = useState(true);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const start = Date.now();

    (async () => {
      try {
        await startFetch();
      } catch (e) {
        console.error(e);
      } finally {
        const elapsed = Date.now() - start;
        const remain = Math.max(0, minDuration - elapsed);

        setTimeout(() => {
          setHide(true);

          setTimeout(() => {
            setRender(false);
            onFinish?.();
          }, 300);
        }, remain);
      }
    })();
  }, []);

  if (!render) return null;

  return (
    <div
      className={` fixed inset-0 z-[9999] flex justify-center items-center bg-[#2373FF] 
      transition-opacity duration-300
      ${hide ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <img
        src="/icons/busondan_white.svg"
        alt="logo"
        className="w-[160px] h-auto object-contain"
      />
    </div>
  );
}

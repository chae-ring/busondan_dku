import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
} from "react";
import {
  API_BASE,
  getBusColor,
  directionMap,
  stationMap,
} from "../utils/helpers";

export default function DetailView({ station, route, onBack }) {
  const [activeDay, setActiveDay] = useState("월");
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({});
  const isUp = Object.values(stationMap.up).includes(station);
  const fallbackEnd = directionMap[isUp ? "up" : "down"]?.[route];
  const timeRefs = useRef({});

  const stationIdMap = useMemo(
    () => ({
      죽전역: 228001028,
      정문: 228001978,
      종합실험동: 228001979,
      인문관: 228001981,
      평화의광장: 228001980,
      치과병원: 228001737,
    }),
    []
  );

  const fetchTimetable = useCallback(async () => {
    if (times.length === 0) setLoading(true);
    setError(null);

    const stationId = stationIdMap[station];
    if (!stationId) {
      setError("준비된 시간표가 없습니다");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/buses/stations/${stationId}/timetable?routeId=${route}`
      );

      if (!response.ok) {
        setError("준비된 시간표가 없습니다.");
        setLoading(false);
        return;
      }

      const json = await response.json();

      setData({
        stationName: json.stationName || station,
        endStationName:
          (json.endStationName && json.endStationName !== "-"
            ? json.endStationName
            : null) || fallbackEnd,
      });

      const dayData = json.dayofweek?.find((d) => d.name === activeDay);
      const timetableArray = dayData?.timetable || [];

      if (timetableArray.length === 0) {
        setTimes([]);
        setError("해당 요일의 시간표가 없습니다");
        return;
      }

      setTimes(timetableArray.map((t) => t.predict));
    } catch (err) {
      console.error(err);
      setError("준비된 시간표가 없습니다");
      setData({
        stationName: station,
        endStationName: fallbackEnd,
      });
    } finally {
      setLoading(false);
    }
  }, [station, route, activeDay, fallbackEnd, stationIdMap, times.length]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  useLayoutEffect(() => {
    setTimeout(() => {
      const main = document.querySelector("main");
      if (main) main.scrollTo(0, 0);
    }, 80);
  }, []);

  const closestIndex = useMemo(() => {
    if (!times || times.length === 0) return -1;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const toMinutes = (timeStr) => {
      if (!timeStr || timeStr.length < 5) return Infinity;
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const upcoming = times
      .map((t, i) => ({ diff: toMinutes(t) - currentMinutes, index: i }))
      .filter((x) => x.diff >= 0);

    return upcoming.length > 0 ? upcoming[0].index : -1;
  }, [times]);

  useEffect(() => {
    if (closestIndex < 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = timeRefs.current[closestIndex];

        if (el) {
          el.scrollIntoView({ block: "center", behavior: "auto" });
        }
      });
    });
  }, [closestIndex]);

  return (
    <div
      className="fixed inset-0 z-50 bg-white font-pretendard overflow-hidden pt-[env(safe-area-inset-top)]"
      //style={{ height: "100dvh" }}
    >
      <div className="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-white z-[999]" />

      <style>{`
        html,
        body {
          background-color: #FFFFFF;
          overflow: hidden;
        }
        ::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="max-w-[393px] mx-auto relative">
        <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] h-[58px] bg-white border-b border-[#E6E7E9] rounded-t-[12px] flex items-center px-[16px]">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-[24px] h-[24px] mr-[12px]"
          >
            <img
              src="/icons/back.svg"
              alt="뒤로가기"
              className="w-[24px] h-[24px]"
            />
          </button>

          <div className="flex items-center">
            <h1
              className={`text-[18px] leading-[22px] font-bold ${getBusColor(
                route
              )}`}
            >
              {route}
            </h1>
          </div>
        </header>

        <main className="w-full max-w-[393px] mx-auto bg-[#ffffff] border-t border-[#E6E7E9] pt-[60px] overflow-hidden">
          <section className="px-[20px] bg-white h-[94px] flex flex-col items-center justify-center border-b border-[#E6E7E9]">
            <span className="text-[18px] leading-[22px] font-bold text-[#212326]">
              {data.stationName || station}
            </span>
            <span className="text-[12px] leading-[14px] font-medium text-[#828386] mt-[8px]">
              {data.endStationName || fallbackEnd
                ? `${data.endStationName || fallbackEnd} 방면`
                : ""}
            </span>
          </section>

          <section className="px-[20px] bg-white flex flex-col gap-[16px] mt-[16px] mb-[16px]">
            <div className="flex gap-[8px]">
              {["월", "화", "수", "목", "금", "토", "휴일"].map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  className={`${
                    d === "휴일" ? "w-[49px]" : "w-[37px]"
                  } h-[34px] rounded-[17px] border-[1.2px] flex items-center justify-center font-pretendard text-[14px] leading-[18px] transition-all
                  ${
                    activeDay === d
                      ? "bg-[#FFFFFF] text-[#2373FF] border-[#2373FF] font-bold shadow-sm"
                      : "bg-[#FFFFFF] text-[#828386] border-[#E6E7E9] font-medium"
                  }`}
                  style={
                    activeDay === d
                      ? { boxShadow: "0 0 4px 0 rgba(35, 115, 255, 0.3)" }
                      : {}
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </section>

          <div className="px-[20px] mt-[16px] pb-[40px] flex justify-center">
            <div
              className="bg-white border border-[#E6E7E9] rounded-[12px] overflow-hidden flex flex-col"
              style={{
                width: "353px",
                height: times.length === 0 ? "75px" : "calc(100dvh - 255px)",
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  height: "calc(100dvh - 160px)",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#BABBBd transparent",
                }}
              >
                <style jsx>{`
                  div::-webkit-scrollbar {
                    width: 4px;
                  }
                  div::-webkit-scrollbar-thumb {
                    background-color: #babbbd;
                    border-radius: 2px;
                  }
                  div::-webkit-scrollbar-track {
                    background: transparent;
                  }
                `}</style>

                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#212326] py-6">불러오는 중...</p>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#212326] py-6">{error}</p>
                  </div>
                ) : times.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#212326] py-6">
                      준비된 시간표가 없습니다.
                    </p>
                  </div>
                ) : (
                  <ul>
                    {times.map((t, i) => {
                      const isClosest = i === closestIndex;
                      const isFirst = i === 0;
                      const isLast = i === times.length - 1;
                      return (
                        <li
                          key={`${t}-${i}`}
                          ref={(el) => {
                            if (el) timeRefs.current[i] = el;
                          }}
                          className={`h-[52px] flex items-center justify-center border-b border-[#E6E7E9] last:border-none ${
                            isClosest ? "bg-[#EBF2FF]" : "bg-[#FFFFFF]"
                          }`}
                        >
                          {isFirst && (
                            <div className="flex items-center justify-center mr-[4px]">
                              <div className="w-[16px] h-[16px] rounded-[12px] border-[1px] border-[#2373FF] flex items-center justify-center">
                                <span className="text-[9px] font-semibold text-[#2373FF] mb-[-1px]">
                                  첫
                                </span>
                              </div>
                            </div>
                          )}

                          {isLast && (
                            <div className="flex items-center justify-center mr-[4px]">
                              <div className="w-[16px] h-[16px] rounded-[12px] border-[1px] border-[#FF2F2F] flex items-center justify-center">
                                <span className="text-[9px] font-semibold text-[#FF2F2F] translate-y-[0.8px]">
                                  막
                                </span>
                              </div>
                            </div>
                          )}

                          <span className="text-[16px] leading-[20px] font-medium text-[#212326]">
                            {t}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

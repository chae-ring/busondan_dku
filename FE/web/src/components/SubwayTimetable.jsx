import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLayoutEffect } from "react";
import { API_BASE } from "../utils/helpers";

export default function SubwayTimetable({ updnLine = "up", onBack }) {
  const [activeDay, setActiveDay] = useState("월");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  const timeRefs = useRef({});
  const cacheRef = useRef({});

  const groupByHour = (list) => {
    const grouped = [];
    const byHour = {};
    list.forEach((t) => {
      const time = t.time;
      if (!time || time.length < 5) return;
      const hour = time.slice(0, 2);
      if (!byHour[hour]) byHour[hour] = [];
      byHour[hour].push(t);
    });
    Object.keys(byHour)
      .sort((a, b) => {
        const A = Number(a);
        const B = Number(b);
        const adjust = (h) => (h < 4 ? h + 24 : h);
        return adjust(A) - adjust(B);
      })
      .forEach((h) => grouped.push({ hour: h, times: byHour[h] }));

    return grouped;
  };
  useLayoutEffect(() => {
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;

      const main = document.querySelector("main");
      if (main) main.scrollTo(0, 0);
    }, 80);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (cacheRef.current[activeDay]) {
        setRows(cacheRef.current[activeDay]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `${API_BASE}/subway/timetable?updnLine=${updnLine}`
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const dayData = json.dayofweek.find((d) => d.name === activeDay);
        const rawTimetable = dayData
          ? dayData.timetables || dayData.timtables || []
          : [];

        const timetable = rawTimetable.filter(
          (v, i, arr) => arr.findIndex((x) => x.time === v.time) === i
        );

        const grouped = groupByHour(timetable);

        cacheRef.current[activeDay] = grouped;

        setRows(grouped);
      } catch (err) {
        console.error(err);
        setError("시간표 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeDay, updnLine]);

  const closestTime = useMemo(() => {
    const flat = rows.flatMap((r) => r.times);
    if (!flat.length) return null;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const toMinutes = (timeStr) => {
      if (!timeStr || timeStr.length < 5) return Infinity;
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const upcoming = flat
      .map((t) => ({ diff: toMinutes(t.time) - currentMinutes, t }))
      .filter((x) => x.diff >= 0);

    return upcoming.length > 0 ? upcoming[0].t.time : null;
  }, [rows]);

  const didScrollRef = useRef(false);

  useEffect(() => {
    didScrollRef.current = false;
  }, [activeDay]);

  useLayoutEffect(() => {
    if (loading || !rows.length) return;

    if (didScrollRef.current) return;
    didScrollRef.current = true;

    const targetTime = closestTime || (rows[0]?.times[0]?.time ?? null);
    if (!targetTime) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = timeRefs.current[targetTime];
        if (!el) return;
        const parent = el.closest(".scroll-area");
        if (!parent) return;

        const vh = window.innerHeight;
        const offsetTop = el.offsetTop - vh / 2 + 50;

        parent.scrollTo({
          top: offsetTop,
          behavior: "auto",
        });
      });
    });
  }, [closestTime, rows, loading]);

  return (
    <div className="fixed inset-0 z-50 bg-[#FFFFFF] min-h-screen font-pretendard pt-[env(safe-area-inset-top)]">
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
            <h1 className="text-[18px] leading-[22px] font-bold text-[#212326]">
              죽전역{" "}
              <span className="text-[#FFAA00] font-bold">수인분당선</span>
            </h1>
            <span className="mx-[8px] text-[#D9D9D9]">|</span>
            <p className="text-[14px] leading-[18px] font-medium text-[#828386]">
              {updnLine === "up" ? "오리 방면" : "보정 방면"}
            </p>
          </div>
        </header>

        <main className="w-full max-w-[393px] mx-auto bg-[#ffffff] border-t border-[#E6E7E9] pt-[58px] overflow-hidden">
          <section className="px-[20px] bg-white flex flex-col gap-[16px] mt-[16px] mb-[16px]">
            <div className="flex gap-[8px]">
              {["월", "화", "수", "목", "금", "토", "휴일"].map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  className={`${
                    d === "휴일" ? "w-[49px]" : "w-[37px]"
                  } h-[34px] rounded-[17px] border-[1.2px] flex items-center justify-center text-[14px] leading-[18px]
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

          <section className="px-[20px] pb-[100px] h-full flex justify-center">
            <style>{`
              .scroll-area::-webkit-scrollbar {
                display: block;
                width: 4px;
              }
              .scroll-area::-webkit-scrollbar-thumb {
                background-color: #babbbd;
                border-radius: 2px;
              }
              .scroll-area::-webkit-scrollbar-track {
                background: transparent;
              }
            `}</style>

            <div className="bg-white border border-[#E6E7E9] rounded-[12px] overflow-hidden mx-auto w-full max-w-[353px]">
              <div
                className="overflow-y-auto scroll-area overscroll-contain"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#BABBBd transparent",
                  height: !rows.length ? "75px" : "calc(100dvh - 160px)",
                }}
              >
                <style jsx>{`
                  .scroll-area::-webkit-scrollbar {
                    display: block;
                    width: 4px;
                  }
                  .scroll-area::-webkit-scrollbar-thumb {
                    background-color: #babbbd;
                    border-radius: 2px;
                  }
                  .scroll-area::-webkit-scrollbar-track {
                    background: transparent;
                  }
                `}</style>

                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#212326] py-6">불러오는 중...</p>
                  </div>
                ) : !rows.length ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#212326] py-6">운행 정보 없음</p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-[#E6E7E9]">
                    {rows.map((block) => (
                      <div
                        key={block.hour}
                        className="flex bg-white"
                        style={{ minHeight: "52px" }}
                      >
                        <div className="w-[120px] flex justify-center items-center pt-[8px] bg-[#ffffff] text-[#828386] text-[16px] leading-[20px] font-medium">
                          {block.hour}시
                        </div>

                        <div className="flex flex-col flex-1 border-l border-[#E6E7E9]">
                          {block.times.map((t, i) => {
                            const isFirst = t.firstTrain;
                            const isLast = t.lastTrain;
                            const isClosest = t.time === closestTime;

                            return (
                              <div
                                key={t.time + i}
                                ref={(el) => {
                                  if (el) timeRefs.current[t.time] = el;
                                }}
                                className={`flex flex-col justify-center items-center h-[70px] border-b border-[#e6e7e9] last:border-none ${
                                  isClosest ? "bg-[#EBF2FF]" : "bg-white"
                                }`}
                              >
                                <div className="flex items-center justify-center">
                                  {isFirst && (
                                    <div className="flex items-center justify-center mr-[6px]">
                                      <div
                                        className="w-[16px] h-[16px] rounded-[12px] border border-[#2373FF] flex-shrink-0 relative"
                                        style={{ display: "inline-block" }}
                                      >
                                        <span
                                          className="absolute left-1/2 top-1/2 text-[9px] font-semibold text-[#2373FF]"
                                          style={{
                                            transform: "translate(-50%, -50%)",
                                            lineHeight: "1",
                                          }}
                                        >
                                          첫
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {isLast && (
                                    <div className="flex items-center justify-center mr-[6px]">
                                      <div
                                        className="w-[16px] h-[16px] rounded-[12px] border border-[#FF2F2F] flex-shrink-0 relative"
                                        style={{ display: "inline-block" }}
                                      >
                                        <span
                                          className="absolute left-1/2 top-1/2 text-[9px] font-semibold text-[#FF2F2F]"
                                          style={{
                                            transform: "translate(-50%, -50%)",
                                            lineHeight: "1",
                                          }}
                                        >
                                          막
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  <span className="text-[16px] leading-[20px] font-medium text-[#212326]">
                                    {t.time}
                                  </span>
                                </div>

                                <div className="flex items-center justify-center mt-[4px]">
                                  <span className="text-[12px] leading-[14px] font-medium text-[#828386]">
                                    {t.startStation}
                                  </span>
                                  <img
                                    src="/icons/arrow_route.svg"
                                    alt="arrow"
                                    className="w-[12px] h-[12px]"
                                  />
                                  <span className="text-[12px] leading-[14px] font-medium text-[#828386]">
                                    {t.endStationName}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

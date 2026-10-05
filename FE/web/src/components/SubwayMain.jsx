import React, { useState, useEffect, useRef } from "react";
import NoticeView from "./NoticeView";
import { API_BASE } from "../utils/helpers";

export default function SubwayMain({
  activeTab,
  setActiveTab,
  setSubwayView,
  setUpdnLine,
  hasNewNotice,
  setHasNewNotice,
}) {
  const [data, setData] = useState({ up: [], down: [] });
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(true);
  const [failCount, setFailCount] = useState(0);
  const [showNotice, setShowNotice] = useState(false);
  const [refreshSpin, setRefreshSpin] = useState(0);
  const [refreshLocked, setRefreshLocked] = useState(false);
  const lastManualRefresh = useRef(0);

  const spinRefresh = () => {
    setRefreshSpin((prev) => prev + 1);
  };

  const handleRefresh = async () => {
    if (refreshLocked) {
      spinRefresh();
      return;
    }

    spinRefresh();
    setRefreshLocked(true);
    lastManualRefresh.current = Date.now();
    setCountdown(10);

    await fetchData();

    setTimeout(() => setRefreshLocked(false), 2000);
  };

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/subway/arrivals`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();

      const parseRemain = (raw) => {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          if (trimmed === "") return null;
          const num = Number(trimmed);
          return isNaN(num) ? null : num;
        }
        if (typeof raw === "number") return raw;
        return null;
      };

      const getArrivalTime = (remain) => {
        if (remain === null || remain === undefined || isNaN(remain))
          return "-";
        const now = new Date();
        now.setMinutes(now.getMinutes() + remain);
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      };

      const upTrains =
        json.up?.arrivalInfoList?.map((item) => {
          const remain = parseRemain(item.remainingTime);
          const arrivalTime = getArrivalTime(remain);
          return {
            destination:
              item.endStationName === "-" || !item.endStationName
                ? "죽전"
                : item.endStationName,
            remain,
            startStation:
              item.startStationName === "-" || !item.startStationName
                ? "죽전"
                : item.startStationName,
            arrivalTime,
            type: item.type || "live",
            lastTrain: item.lastTrain,
          };
        }) || [];

      const downTrains =
        json.down?.arrivalInfoList?.map((item) => {
          const remain = parseRemain(item.remainingTime);
          const arrivalTime = getArrivalTime(remain);
          return {
            destination:
              item.endStationName === "-" || !item.endStationName
                ? "죽전"
                : item.endStationName,
            remain,
            startStation:
              item.startStationName === "-" || !item.startStationName
                ? "죽전"
                : item.startStationName,
            arrivalTime,
            type: item.type || "timetable",
            lastTrain: item.lastTrain,
          };
        }) || [];

      setData({ up: upTrains, down: downTrains });
      setFailCount(0);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setFailCount((prev) => {
        const next = prev + 1;
        if (next >= 10) {
          setData({ up: [], down: [] });
        }
        return next;
      });
    }
  };

  useEffect(() => {
    fetchData();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        const now = Date.now();

        if (prev <= 1) {
          if (now - lastManualRefresh.current >= 10000) {
            fetchData();
          }
          return 10;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (showNotice) {
    return <NoticeView onBack={() => setShowNotice(false)} />;
  }

  return (
    <div className="bg-[#F6F7F9] min-h-screen font-pretendard pt-[env(safe-area-inset-top)]">
      <div className="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-white z-[999]" />
      <div className="max-w-[393px] mx-auto">
        <header className="relative bg-white w-full h-[58px] px-[20px] pb-[12px] flex flex-col justify-end z-[50]">
          <img
            src="/icons/busondan.svg"
            alt="busondan"
            className="w-[100px] h-[30px] object-contain"
          />

          <div
            className="absolute bottom-[14px] right-[20px] w-[24px] h-[24px] cursor-pointer z-[60]"
            onClick={() => {
              setHasNewNotice(false);
              setShowNotice(true);
            }}
          >
            <img
              src="/icons/notice.svg"
              alt="notice"
              className="w-[24px] h-[24px] object-contain"
            />

            {hasNewNotice && (
              <div className="absolute -top-[2px] -right-[2px] w-[8px] h-[8px] bg-[#FF3B30] rounded-full" />
            )}
          </div>
        </header>

        <main className="w-full bg-[#F6F7F9] px-[16px] pb-[90px] flex flex-col">
          <div className="w-full bg-white rounded-[12px] overflow-hidden mx-auto mt-[20px]">
            <img
              src="/icons/ad_banner.png"
              alt="banner"
              className="w-full h-full"
            />
          </div>
          <section className="flex flex-col items-center mb-[8px]">
            <h2 className="text-[20px] leading-[24px] font-bold text-[#212326] mt-[32px]">
              죽전역{" "}
              <span className="text-[#FFAA00] text-[20px] leading-[24px] font-bold">
                수인분당선
              </span>
            </h2>

            <div
              className="flex items-center justify-between mt-[18px] rounded-[12px] bg-[#FFAA00]"
              style={{ width: "350px", height: "24px" }}
            >
              <button className="flex items-center text-[14px] leading-[18px] text-[#ffffff] font-medium px-[8px]">
                <img
                  src="/icons/arrow_left.svg"
                  alt="arrow-left"
                  className="w-[16px] h-[16px] mr-[8px]"
                />
                <span style={{ transform: "translateY(-0.1px)" }}>오리</span>
              </button>

              <div
                className="flex items-center justify-center bg-[#ffffff] rounded-[19px] border-[2px] border-[#FFAA00]"
                style={{ width: "188px", height: "36px" }}
              >
                <div className="flex items-center space-x-[10px]">
                  <div
                    className="flex items-center justify-center rounded-[20px] bg-[#FFAA00] text-white text-[12px] leading-[14px] font-semibold"
                    style={{
                      width: "54px",
                      height: "18px",
                      paddingTop: "1px",
                    }}
                  >
                    수인분당
                  </div>
                  <span className="text-[16px] leading-[20px] font-medium text-[#212326]">
                    죽전
                  </span>
                </div>
              </div>

              <button className="flex items-center text-[14px] leading-[18px] text-[#ffffff] font-medium px-[8px]">
                <span style={{ transform: "translateY(-0.1px)" }}>보정</span>
                <img
                  src="/icons/arrow_right.svg"
                  alt="arrow-right"
                  className="w-[16px] h-[16px] ml-[8px]"
                />
              </button>
            </div>
          </section>
          <section className="flex flex-col gap-[12px] mt-[34px] ">
            <div
              className="flex justify-between items-center"
              //style={{ width: "345px" }}
            >
              <div
                className="flex items-center space-x-[8px] ml-[10px] cursor-pointer"
                onClick={() => {
                  requestAnimationFrame(() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    document.querySelector("main")?.scrollTo(0, 0);
                  });

                  setUpdnLine("up");
                  setSubwayView("subway-detail");
                }}
              >
                <h3 className="text-[18px] leading-[22px] font-bold text-[#212326]">
                  오리 방면
                </h3>
                <img
                  src="/icons/more_subway.svg"
                  alt="more"
                  className="w-[16px] h-[16px] translate-y-[-1px]"
                />
              </div>

              <div className="flex items-center space-x-[4px] mr-[10px]">
                <span className="text-[14px] leading-[18px] font-medium text-[#828386]">
                  {countdown}초
                </span>
                <img
                  src="/icons/refresh.svg"
                  alt="refresh"
                  onClick={handleRefresh}
                  className="w-[24px] h-[24px] cursor-pointer transition-transform duration-500"
                  style={{
                    transform: `rotate(${refreshSpin * -360}deg)`,
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-[12px] border border-[#E6E7E9] py-[20px] mx-auto w-full max-w-[350px] px-[16px]">
              <div className="flex flex-col gap-[20px]">
                {(() => {
                  const validUp = (data.up || []).filter((t) => {
                    const hasRemain = t.remain != null && !isNaN(t.remain);
                    const hasTime = t.arrivalTime && t.arrivalTime !== "-";
                    return hasRemain || hasTime;
                  });

                  if (validUp.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-[64px]">
                        <p className="text-[12px] leading-[14px] text-[#babbbd] font-normal">
                          운행 정보 없음
                        </p>
                      </div>
                    );
                  }

                  return validUp.map((train, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center h-[20px]"
                    >
                      <p className="flex items-center">
                        <span className="text-[16px] leading-[20px] font-bold text-[#212326]">
                          {train.arrivalTime}
                        </span>

                        <span className="text-[14px] leading-[18px] text-[#828386] ml-[8px]">
                          {train.startStation}
                        </span>

                        <img
                          src="/icons/subway_arrow.svg"
                          alt="방향"
                          className="w-[12px] h-[12px]"
                        />

                        <span className="text-[14px] leading-[18px] text-[#828386]">
                          {train.destination}
                        </span>
                      </p>

                      <div className="flex items-center justify-end space-x-[6px]">
                        <style>{`
                            @keyframes softBlink {
                              0%,
                              100% {
                                opacity: 1;
                              }
                              50% {
                                opacity: 0.48;
                              }
                            }
                            .soft-blinking {
                              animation: softBlink 2.78s ease-in-out infinite;
                            }
                          `}</style>

                        {train.type === "live" && (
                          <p className="soft-blinking text-[10px] leading-[14px] font-medium text-[#2373FF] bg-[#DBE8FF] px-[4px] py-[2px] rounded-[5px]">
                            실시간
                          </p>
                        )}
                        {train.type === "timetable" && (
                          <p className="text-[10px] leading-[14px] font-medium text-[#828386] bg-[#E6E7E9] px-[4px] py-[2px] rounded-[5px]">
                            시간표 기준
                          </p>
                        )}

                        <p
                          className={`text-[16px] leading-[20px] font-bold ${
                            i === 0 ? "text-[#2373FF]" : "text-[#212326]"
                          }`}
                        >
                          {train.remain == null || isNaN(train.remain)
                            ? "-"
                            : train.remain < 1
                            ? "곧 도착"
                            : `${train.remain}분 후`}
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-[12px] mt-[34px]">
            <div
              className="flex justify-between items-center"
              //style={{ width: "345px" }}
            >
              <div
                className="flex items-center space-x-[8px] ml-[10px] cursor-pointer"
                onClick={() => {
                  requestAnimationFrame(() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTo(0, 0);
                    document.body.scrollTo(0, 0);
                    document.querySelector("main")?.scrollTo(0, 0);
                  });

                  setUpdnLine("down");
                  setSubwayView("subway-detail");
                }}
              >
                <h3 className="text-[18px] leading-[22px] font-bold text-[#212326]">
                  보정 방면
                </h3>
                <img
                  src="/icons/more_subway.svg"
                  alt="more"
                  className="w-[16px] h-[16px] translate-y-[-1px]"
                />
              </div>

              <div className="flex items-center space-x-[4px] mr-[10px]">
                <span className="text-[14px] leading-[18px] font-medium text-[#828386]">
                  {countdown}초
                </span>
                <img
                  src="/icons/refresh.svg"
                  alt="refresh"
                  onClick={handleRefresh}
                  className="w-[24px] h-[24px] cursor-pointer transition-transform duration-500"
                  style={{
                    transform: `rotate(${refreshSpin * -360}deg)`,
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-[12px] border border-[#E6E7E9] py-[20px] mx-auto w-full max-w-[350px] px-[16px]">
              <div className="flex flex-col gap-[20px]">
                {(() => {
                  const validDown = (data.down || []).filter((t) => {
                    const hasRemain = t.remain != null && !isNaN(t.remain);
                    const hasTime = t.arrivalTime && t.arrivalTime !== "-";
                    return hasRemain || hasTime;
                  });

                  if (validDown.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-[64px]">
                        <p className="text-[12px] leading-[14px] text-[#babbbd] font-normal">
                          운행 정보 없음
                        </p>
                      </div>
                    );
                  }

                  return validDown.map((train, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center h-[20px]"
                    >
                      <p className="flex items-center">
                        <span className="text-[16px] leading-[20px] font-bold text-[#212326]">
                          {train.arrivalTime}
                        </span>

                        <span className="text-[14px] leading-[18px] text-[#828386] ml-[8px]">
                          {train.startStation}
                        </span>

                        <img
                          src="/icons/subway_arrow.svg"
                          alt="방향"
                          className="w-[12px] h-[12px]"
                        />

                        <span className="text-[14px] leading-[18px] text-[#828386]">
                          {train.destination}
                        </span>
                      </p>

                      <div className="flex items-center justify-end space-x-[6px]">
                        <style>{`
                            @keyframes softBlink {
                              0%,
                              100% {
                                opacity: 1;
                              }
                              50% {
                                opacity: 0.48;
                              }
                            }
                            .soft-blinking {
                              animation: softBlink 2.78s ease-in-out infinite;
                            }
                          `}</style>

                        {train.type === "live" && (
                          <p className="soft-blinking text-[10px] leading-[14px] font-medium text-[#2373FF] bg-[#DBE8FF] px-[4px] py-[2px] rounded-[5px]">
                            실시간
                          </p>
                        )}
                        {train.type === "timetable" && (
                          <p className="text-[10px] leading-[14px] font-medium text-[#828386] bg-[#E6E7E9] px-[4px] py-[2px] rounded-[5px]">
                            시간표 기준
                          </p>
                        )}

                        <p
                          className={`text-[16px] leading-[20px] font-bold ${
                            i === 0 ? "text-[#2373FF]" : "text-[#212326]"
                          }`}
                        >
                          {train.remain == null || isNaN(train.remain)
                            ? "-"
                            : train.remain < 1
                            ? "곧 도착"
                            : `${train.remain}분 후`}
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </section>
        </main>

        <div className="border-t border-[#E6E7E9] mt-[120px] pb-[90px]">
          <div className="text-center py-[20px]">
            <div className="flex justify-center space-x-[6px] text-[10px] font-semibold text-[#828386]">
              <a
                href="https://busondan.notion.site/2a1a4cf4c61c80d08078e26338835ec2?source=copy_link"
                className="hover:underline"
              >
                버스온단 이용약관
              </a>

              <span className="text-[10px] text-[#E6E7E9] font-regular">|</span>

              <a
                href="https://busondan.notion.site/2a1a4cf4c61c80d097e5feec2a7a32c4?source=copy_link"
                className="hover:underline"
              >
                사용방법
              </a>

              <span className="text-[10px] text-[#E6E7E9] font-regular">|</span>

              <a
                href="https://busondan.notion.site/2a1a4cf4c61c80fd9ac7ca4732c9fd60?source=copy_link"
                className="hover:underline"
              >
                문의하기
              </a>
            </div>
            <p className="mt-[8px] text-[10px] font-regular text-[#828386]">
              이메일 : contact@busondan.org
            </p>
            <p className="mt-[8px] text-[10px] text-[#828386] font-light">
              ©버스온단. All rights reserved.
            </p>
          </div>
        </div>

        <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] h-[90px] bg-white border-t border-[#E6E7E9] rounded-t-[12px] flex justify-between items-center px-[102.25px] pt-[12px] pb-[36px]">
          <button
            onClick={() => setActiveTab("bus")}
            className="flex flex-col items-center justify-center space-y-[4px]"
          >
            <img
              src={
                activeTab === "bus"
                  ? "/icons/bus_active.svg"
                  : "/icons/bus_default.svg"
              }
              alt="버스"
              className="w-[24px] h-[24px]"
            />
            <span
              className={`text-[12px] leading-[14px] font-semibold ${
                activeTab === "bus" ? "text-[#2373FF]" : "text-[#BABBBD]"
              }`}
            >
              버스
            </span>
          </button>

          <button
            onClick={() => setActiveTab("subway")}
            className="flex flex-col items-center justify-center space-y-[4px]"
          >
            <img
              src={
                activeTab === "subway"
                  ? "/icons/subway_active.svg"
                  : "/icons/subway_default.svg"
              }
              alt="지하철"
              className="w-[24px] h-[24px]"
            />
            <span
              className={`text-[12px] leading-[14px] font-semibold ${
                activeTab === "subway" ? "text-[#2373FF]" : "text-[#BABBBD]"
              }`}
            >
              지하철
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}

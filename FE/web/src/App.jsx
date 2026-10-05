import React, { useState, useEffect, useCallback, useRef } from "react";
import NoticeView from "./components/NoticeView";
import Tab from "./components/Tab";
import BusRow from "./components/BusRow";
import DetailView from "./components/DetailView";
import SubwayMain from "./components/SubwayMain";
import SubwayTimetable from "./components/SubwayTimetable";
import SplashScreen from "./components/SplashScreen";
import { directionMap, API_BASE, stationMap } from "./utils/helpers";

export default function App() {
  const [busData, setBusData] = useState({
    up: { stops: Object.values(stationMap.up), stops_data: {} },
    down: { stops: Object.values(stationMap.down), stops_data: {} },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const [activeTab, setActiveTab] = useState("bus");
  const [subwayView, setSubwayView] = useState("subway-main");
  const [updnLine, setUpdnLine] = useState("up");
  const [showNotice, setShowNotice] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showUpTimetable, setShowUpTimetable] = useState(false);
  const [showDownTimetable, setShowDownTimetable] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [hasNewNotice, setHasNewNotice] = useState(false);
  const refreshLocked = useState(false);
  const isFetching = useRef(false);
  const lastManualRefresh = useRef(0);
  const [refreshSpin, setRefreshSpin] = useState(0);

  const splashStartRef = useRef(0);
  const MIN_SPLASH_MS = 800;
  const MAX_SPLASH_MS = 4000;

  const upTimetableRef = useRef(null);

  const [view, setView] = useState("list");
  const [detailMeta, setDetailMeta] = useState(null);

  const [activeUpTab, setActiveUpTab] = useState(stationMap.up["228001028"]);
  const [activeDownTab, setActiveDownTab] = useState(
    stationMap.down["228001980"]
  );

  const spinRefresh = () => {
    setRefreshSpin((prev) => prev + 1);
  };

  const handleRefresh = async () => {
    if (refreshLocked[0]) {
      spinRefresh();
      return;
    }

    spinRefresh();
    refreshLocked[1](true);

    lastManualRefresh.current = Date.now();
    setCountdown(10);

    await fetchBusData();

    setTimeout(() => refreshLocked[1](false), 2000);
  };

  useEffect(() => {
    const checkNotices = async () => {
      try {
        const stored = localStorage.getItem("prevNoticeIds");
        const prevIds = stored ? JSON.parse(stored) : [];

        const res = await fetch(`${API_BASE}/notifications`);
        const data = await res.json();
        const notices = data.notifications || [];

        const newExists = notices.some((n) => !prevIds.includes(String(n.id)));
        setHasNewNotice(newExists);
      } catch (err) {
        console.log(err);
      }
    };

    checkNotices();
    const interval = setInterval(checkNotices, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchBusData = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;

    if (!firstLoadDone) {
      splashStartRef.current = Date.now();
    }
    const parseRemain = (val) => {
      if (val === null || val === undefined) return null;

      const trimmed = String(val).trim();
      if (trimmed === "") return "";

      if (isNaN(trimmed)) return trimmed;

      return parseInt(trimmed, 10);
    };

    try {
      const res = await fetch(`${API_BASE}/bus_info`);
      if (!res.ok) throw new Error("서버 오류");
      const data = await res.json();

      const processed = {
        up: { stops: Object.values(stationMap.up), stops_data: {} },
        down: { stops: Object.values(stationMap.down), stops_data: {} },
      };

      Object.entries(data).forEach(([stationId, station]) => {
        const mapped = (station.busList || []).map((b, i) => ({
          id: `${stationId}-${b.routeName}-${i}`,
          routeName: b.routeName,
          direction: b.direction,
          type: b.type,
          primaryMinutes: parseRemain(b.firstRemainingTime),
          secondaryMinutes: parseRemain(b.secondRemainingTime),
        }));

        if (stationMap.up[stationId]) {
          processed.up.stops_data[stationMap.up[stationId]] = mapped;
        } else if (stationMap.down[stationId]) {
          processed.down.stops_data[stationMap.down[stationId]] = mapped;
        }
      });

      setBusData(processed);
      setFailCount(0);
      setError(null);
    } catch (e) {
      setFailCount((prev) => {
        const next = prev + 1;

        if (next >= 10) {
          const degraded = {
            up: {
              stops: Object.values(stationMap.up),
              stops_data: {},
            },
            down: {
              stops: Object.values(stationMap.down),
              stops_data: {},
            },
          };

          Object.values(stationMap.up).forEach((stop) => {
            degraded.up.stops_data[stop] = [];
          });
          Object.values(stationMap.down).forEach((stop) => {
            degraded.down.stops_data[stop] = [];
          });

          setBusData(degraded);
        }

        return next;
      });
    } finally {
      isFetching.current = false;
      setTimeout(() => setIsLoading(false), 300);
      if (!firstLoadDone) setFirstLoadDone(true);
    }
  }, [API_BASE, firstLoadDone]);

  useEffect(() => {
    if (!showSplash && !firstLoadDone) {
      fetchBusData();
      setFirstLoadDone(true);
    }
  }, [showSplash, firstLoadDone, fetchBusData]);

  useEffect(() => {
    if (showSplash || activeTab !== "bus") return;

    fetchBusData();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        const now = Date.now();

        if (prev <= 1) {
          if (now - lastManualRefresh.current >= 10000) {
            fetchBusData();
          }
          return 10;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchBusData, activeTab, showSplash]);

  if (showSplash) {
    return (
      <SplashScreen
        startFetch={fetchBusData}
        minDuration={MIN_SPLASH_MS}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  if (showNotice) {
    return <NoticeView onBack={() => setShowNotice(false)} />;
  }

  if (activeTab === "subway") {
    if (subwayView === "subway-main") {
      return (
        <SubwayMain
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setSubwayView={setSubwayView}
          setUpdnLine={setUpdnLine}
          hasNewNotice={hasNewNotice}
          setHasNewNotice={setHasNewNotice}
        />
      );
    } else if (subwayView === "subway-detail") {
      return (
        <SubwayTimetable
          updnLine={updnLine}
          onBack={() => setSubwayView("subway-main")}
        />
      );
    }
  }

  if (view === "detail" && detailMeta)
    return (
      <DetailView
        station={detailMeta.station}
        route={detailMeta.route}
        onBack={() => setView("list")}
      />
    );

  return (
    <div className="bg-[#F6F7F9] min-h-screen font-pretendard relative pt-[env(safe-area-inset-top)]">
      <div className="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-white z-[999]" />
      <div className="max-w-[393px] mx-auto">
        <header className="relative bg-white w-full h-[58px] px-[20px] pb-[12px] flex flex-col justify-end">
          <img
            src="/icons/busondan.svg"
            alt="busondan"
            className="w-[100px] h-[30px] object-contain"
          />

          <div
            className="absolute bottom-[14px] right-[20px] w-[24px] h-[24px] cursor-pointer"
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

        <main className="w-full bg-[#F6F7F9] px-[16px] pt-[20px] pb-[90px] flex flex-col">
          <a
            href="https://busondan.notion.site/2ada4cf4c61c808b981aff6fd9467849?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="w-full bg-white rounded-[12px] overflow-hidden mx-auto mb-[16px] ">
              <img
                src="/icons/ad_banner.png"
                alt="banner"
                className="w-full h-full"
              />
            </div>
          </a>

          <section className="flex flex-col gap-[12px]">
            <div className="flex justify-between items-center px-[5px]">
              <h2 className="text-[18px] leading-[22px] font-bold text-[#212326]">
                상행 (캠퍼스 방면)
              </h2>
              <div className="flex items-center space-x-[4px]">
                <span className="text-[14px] leading-[18px] text-[#828386]">
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

            <div className="flex space-x-[8px] overflow-x-auto">
              {["죽전역", "치과병원", "종합실험동"].map((stop) => (
                <Tab
                  key={stop}
                  name={stop}
                  activeTab={activeUpTab}
                  setActiveTab={setActiveUpTab}
                />
              ))}
            </div>

            <div className="bg-white rounded-[12px] border border-[#E6E7E9] overflow-hidden mx-auto w-full max-w-[360px]">
              {(() => {
                const stopData = busData.up.stops_data[activeUpTab] || [];
                const sorted = [...stopData].sort((a, b) => {
                  if (a.routeName === "셔틀버스") return -1;
                  if (b.routeName === "셔틀버스") return 1;
                  return 0;
                });

                if (!stopData.length) {
                  return (
                    <div className="flex justify-center items-center h-[64px] bg-white">
                      <p className="text-[14px] leading-[14px] font-medium text-[#BABBBd]">
                        운행 정보 없음
                      </p>
                    </div>
                  );
                }

                const fixedRoutes =
                  activeUpTab === "죽전역" ? ["셔틀버스", "24", "720-3"] : null;

                const rawLive = sorted.filter(
                  (b) =>
                    b.type === "live" &&
                    b.primaryMinutes !== null &&
                    b.primaryMinutes !== "" &&
                    !isNaN(b.primaryMinutes)
                );

                const shuttle = sorted.find((b) => b.routeName === "셔틀버스");
                const isLiveEmpty = rawLive.length === 0;

                const isShuttleLiveValue = (v) => {
                  if (v === "수시 운행 중") return true;
                  if (v === null || v === "") return false;
                  return !isNaN(Number(v));
                };

                const shuttleHasNoLive =
                  shuttle && !isShuttleLiveValue(shuttle.primaryMinutes);

                let displayLive = [];
                let displayTimetable = [];

                if (fixedRoutes) {
                  const mapped = fixedRoutes.map((name) => {
                    return (
                      sorted.find((b) => b.routeName === name) || {
                        id: `placeholder-${activeUpTab}-${name}`,
                        routeName: name,
                        direction: directionMap.up[name],
                        type: "timetable",
                        primaryMinutes: null,
                        secondaryMinutes: null,
                      }
                    );
                  });

                  if (isLiveEmpty) {
                    const shuttleFirst = shuttle
                      ? [
                          shuttle,
                          ...mapped.filter((b) => b.routeName !== "셔틀버스"),
                        ]
                      : mapped;

                    displayLive = [];
                    displayTimetable = shuttleFirst;
                  } else {
                    const liveSet = mapped.filter(
                      (b) =>
                        b.type === "live" &&
                        b.primaryMinutes !== null &&
                        b.primaryMinutes !== "" &&
                        !isNaN(b.primaryMinutes)
                    );

                    if (shuttleHasNoLive) {
                      displayLive = liveSet.filter(
                        (b) => b.routeName !== "셔틀버스"
                      );

                      displayTimetable = [
                        shuttle,
                        ...mapped.filter(
                          (b) =>
                            !displayLive.includes(b) &&
                            b.routeName !== "셔틀버스"
                        ),
                      ];
                    } else {
                      if (shuttle && liveSet.length > 0) {
                        displayLive = [
                          shuttle,
                          ...liveSet.filter((b) => b.routeName !== "셔틀버스"),
                        ];
                      } else {
                        displayLive = liveSet;
                      }

                      displayTimetable = mapped.filter(
                        (b) => !displayLive.includes(b)
                      );
                    }
                  }
                } else {
                  const isShuttleLive = (bus) => {
                    if (!bus) return false;

                    const v = bus.primaryMinutes;

                    if (v === "수시 운행 중") return true;
                    if (v === null || v === "") return false;

                    return !isNaN(Number(v));
                  };

                  if (isLiveEmpty) {
                    if (isShuttleLive(shuttle)) {
                      displayLive = [shuttle];
                      displayTimetable = sorted.filter(
                        (b) => b.routeName !== "셔틀버스"
                      );
                    } else {
                      const shuttleFirst = shuttle
                        ? [
                            shuttle,
                            ...sorted.filter((b) => b.routeName !== "셔틀버스"),
                          ]
                        : sorted;

                      displayLive = [];
                      displayTimetable = shuttleFirst;
                    }
                  } else if (shuttleHasNoLive) {
                    displayLive = rawLive.filter(
                      (b) => b.routeName !== "셔틀버스"
                    );

                    displayTimetable = [
                      shuttle,
                      ...sorted.filter(
                        (b) =>
                          !displayLive.includes(b) && b.routeName !== "셔틀버스"
                      ),
                    ];
                  } else {
                    displayLive = shuttle ? [shuttle, ...rawLive] : rawLive;

                    displayTimetable = sorted.filter(
                      (b) => !displayLive.includes(b)
                    );
                  }
                }

                if (displayLive.length === 0) {
                  return (
                    <>
                      <div className="flex justify-center items-center h-[64px] bg-white">
                        <p className="text-[14px] font-medium text-[#BABBBd]">
                          운행 정보 없음
                        </p>
                      </div>

                      {!showUpTimetable ? (
                        <div className="relative bg-white">
                          <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                          <button
                            onClick={() => setShowUpTimetable(true)}
                            className="w-full flex justify-center items-center gap-[6px]
              text-[12px] text-[#BABBBd] h-[48px]
              bg-white px-[16px] hover:bg-[#F6F7F9]"
                          >
                            <span>예상시간표</span>
                            <img
                              src="/icons/arrow_under.svg"
                              alt="펼치기"
                              className="w-[16px] h-[16px]"
                            />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="px-[16px] mt-[32px] mb-[8px]">
                            <p className="text-[14px] leading-[18px] text-[#212326] font-bold">
                              예상시간표{" "}
                              <span className="ml-[12px] text-[12px] font-medium text-[#828386]">
                                과거 운행정보 기반
                              </span>
                            </p>
                          </div>

                          {displayTimetable.map((bus, i, arr) => (
                            <BusRow
                              key={`${bus.id}-timetable`}
                              bus={{ ...bus, updnLine: "up" }}
                              isLast={i === arr.length - 1}
                              onArrow={() => {
                                setDetailMeta({
                                  station: activeUpTab,
                                  route: bus.routeName,
                                });
                                setView("detail");
                              }}
                            />
                          ))}

                          <div className="mt-[8px] relative">
                            <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                            <button
                              onClick={() => setShowUpTimetable(false)}
                              className="w-full flex justify-center items-center gap-[12px]
                text-[12px] font-medium text-[#BABBBd]
                h-[48px] bg-white px-[16px] hover:bg-[#F6F7F9]
                rounded-b-[12px]"
                            >
                              <span>예상시간표</span>
                              <img
                                src="/icons/arrow_up.svg"
                                alt="접기"
                                className="w-[16px] h-[16px]"
                              />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                }

                return (
                  <>
                    {displayLive.map((bus, i, arr) => (
                      <BusRow
                        key={bus.id}
                        bus={{ ...bus, updnLine: "up" }}
                        isLast={i === arr.length - 1 && !showUpTimetable}
                        onArrow={() => {
                          setDetailMeta({
                            station: activeUpTab,
                            route: bus.routeName,
                          });
                          setView("detail");
                        }}
                      />
                    ))}

                    {showUpTimetable ? (
                      <div>
                        <div className="px-[16px] mt-[32px] mb-[8px]">
                          <p className="text-[14px] leading-[18px] text-[#212326] font-bold">
                            예상시간표{" "}
                            <span className="ml-[12px] text-[12px] font-medium text-[#828386]">
                              과거 운행정보 기반
                            </span>
                          </p>
                        </div>

                        {displayTimetable.map((bus, i, arr) => (
                          <BusRow
                            key={`${bus.id}-timetable`}
                            bus={{ ...bus, updnLine: "up" }}
                            isLast={i === arr.length - 1}
                            onArrow={() => {
                              setDetailMeta({
                                station: activeUpTab,
                                route: bus.routeName,
                              });
                              setView("detail");
                            }}
                          />
                        ))}

                        <div className="mt-[8px] relative">
                          <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                          <button
                            onClick={() => setShowUpTimetable(false)}
                            className="w-full flex justify-center items-center gap-[12px]
              text-[12px] font-medium text-[#BABBBd]
              h-[48px] bg-white px-[16px] hover:bg-[#F6F7F9]
              rounded-b-[12px]"
                          >
                            <span>예상시간표</span>
                            <img
                              src="/icons/arrow_up.svg"
                              alt="접기"
                              className="w-[16px] h-[16px]"
                            />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative bg-white">
                        <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                        <button
                          onClick={() => setShowUpTimetable(true)}
                          className="w-full flex justify-center items-center gap-[6px]
            text-[12px] text-[#BABBBd] h-[48px]
            bg-white px-[16px] hover:bg-[#F6F7F9]"
                        >
                          <span>예상시간표</span>
                          <img
                            src="/icons/arrow_under.svg"
                            alt="펼치기"
                            className="w-[16px] h-[16px]"
                          />
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </section>

          <section className="flex flex-col gap-[12px] mt-[28px]">
            <div className="flex justify-between items-center px-[5px]">
              <h2 className="text-[18px] leading-[22px] font-bold text-[#212326]">
                하행 (죽전역 방면)
              </h2>
              <div className="flex items-center space-x-[4px]">
                <span className="text-[14px] leading-[18px] text-[#828386]">
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

            <div className="flex space-x-[8px] overflow-x-auto">
              {["평화의광장", "인문관", "정문"].map((stop) => (
                <Tab
                  key={stop}
                  name={stop}
                  activeTab={activeDownTab}
                  setActiveTab={setActiveDownTab}
                />
              ))}
            </div>

            <div className="bg-white rounded-[12px] border border-[#E6E7E9] overflow-hidden mx-auto w-full max-w-[360px]">
              {(() => {
                const stopDataRaw =
                  busData.down.stops_data[activeDownTab] || [];
                const stopData = stopDataRaw.filter(
                  (b) =>
                    !(
                      activeDownTab === "평화의광장" &&
                      b.direction === "단국대.평화의광장"
                    )
                );

                const sorted = [...stopData].sort((a, b) => {
                  if (a.routeName === "셔틀버스") return -1;
                  if (b.routeName === "셔틀버스") return 1;
                  return 0;
                });

                if (sorted.length === 0) {
                  return (
                    <div className="flex justify-center items-center h-[64px] bg-white">
                      <p className="text-[14px] font-medium text-[#BABBBd]">
                        운행 정보 없음
                      </p>
                    </div>
                  );
                }

                const rawLive = sorted.filter(
                  (b) =>
                    b.type === "live" &&
                    b.primaryMinutes !== null &&
                    b.primaryMinutes !== "" &&
                    !isNaN(Number(b.primaryMinutes))
                );

                const shuttle = sorted.find((b) => b.routeName === "셔틀버스");
                const isLiveEmpty = rawLive.length === 0;

                const isShuttleLiveValue = (v) => {
                  if (v === "수시 운행 중") return true;
                  if (v === null || v === "") return false;
                  return !isNaN(Number(v));
                };

                const shuttleHasNoLive =
                  shuttle && !isShuttleLiveValue(shuttle.primaryMinutes);

                let displayLive = [];
                let displayTimetable = [];

                const isShuttleLive = (bus) => {
                  if (!bus) return false;

                  const v = bus.primaryMinutes;

                  if (v === "수시 운행 중") return true;
                  if (v === null || v === "") return false;

                  return !isNaN(Number(v));
                };

                if (isLiveEmpty) {
                  if (isShuttleLive(shuttle)) {
                    displayLive = [shuttle];
                    displayTimetable = sorted.filter(
                      (b) => b.routeName !== "셔틀버스"
                    );
                  } else {
                    const shuttleFirst = shuttle
                      ? [
                          shuttle,
                          ...sorted.filter((b) => b.routeName !== "셔틀버스"),
                        ]
                      : sorted;

                    displayLive = [];
                    displayTimetable = shuttleFirst;
                  }
                } else if (shuttleHasNoLive) {
                  displayLive = rawLive.filter(
                    (b) => b.routeName !== "셔틀버스"
                  );

                  displayTimetable = [
                    shuttle,
                    ...sorted.filter(
                      (b) =>
                        !displayLive.includes(b) && b.routeName !== "셔틀버스"
                    ),
                  ];
                } else {
                  displayLive = shuttle ? [shuttle, ...rawLive] : rawLive;

                  displayTimetable = sorted.filter(
                    (b) => !displayLive.includes(b)
                  );
                }

                if (displayLive.length === 0) {
                  return (
                    <>
                      <div className="flex justify-center items-center h-[64px] bg-white">
                        <p className="text-[14px] leading-[14px] font-medium text-[#BABBBd]">
                          운행 정보 없음
                        </p>
                      </div>

                      {!showDownTimetable ? (
                        <div className="relative">
                          <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                          <button
                            onClick={() => setShowDownTimetable(true)}
                            className="w-full flex justify-center items-center gap-[6px]
              text-[12px] text-[#BABBBd] h-[48px]
              bg-white px-[16px] hover:bg-[#F6F7F9]"
                          >
                            <span>예상시간표</span>
                            <img
                              src="/icons/arrow_under.svg"
                              alt="펼치기"
                              className="w-[16px] h-[16px]"
                            />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="px-[16px] mt-[32px] mb-[8px]">
                            <p className="text-[14px] leading-[18px] text-[#212326] font-bold flex items-center">
                              예상시간표
                              <span className="ml-[12px] text-[12px] leading-[14px] font-medium text-[#828386]">
                                과거 운행정보 기반
                              </span>
                            </p>
                          </div>

                          {displayTimetable.map((bus, i, arr) => (
                            <BusRow
                              key={`${bus.id}-timetable`}
                              bus={{ ...bus, updnLine: "down" }}
                              isLast={i === arr.length - 1}
                              onArrow={() => {
                                setDetailMeta({
                                  station: activeDownTab,
                                  route: bus.routeName,
                                });
                                setView("detail");
                              }}
                            />
                          ))}

                          <div className="mt-[8px] relative">
                            <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                            <button
                              onClick={() => setShowDownTimetable(false)}
                              className="w-full flex justify-center items-center gap-[12px]
                text-[12px] leading-[14px] font-medium text-[#BABBBd]
                h-[48px] bg-white px-[16px] hover:bg-[#F6F7F9]
                rounded-b-[12px]"
                            >
                              <span>예상시간표</span>
                              <img
                                src="/icons/arrow_up.svg"
                                alt="접기"
                                className="w-[16px] h-[16px]"
                              />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                }

                return (
                  <>
                    {displayLive.map((bus, i, arr) => (
                      <BusRow
                        key={bus.id}
                        bus={{ ...bus, updnLine: "down" }}
                        isLast={i === arr.length - 1 && !showDownTimetable}
                        onArrow={() => {
                          setDetailMeta({
                            station: activeDownTab,
                            route: bus.routeName,
                          });
                          setView("detail");
                        }}
                      />
                    ))}

                    {showDownTimetable ? (
                      <div>
                        <div className="px-[16px] mt-[32px] mb-[8px]">
                          <p className="text-[14px] leading-[18px] text-[#212326] font-bold flex items-center">
                            예상시간표
                            <span className="ml-[12px] text-[12px] leading-[14px] font-medium text-[#828386]">
                              과거 운행정보 기반
                            </span>
                          </p>
                        </div>

                        {displayTimetable.map((bus, i, arr) => (
                          <BusRow
                            key={`${bus.id}-timetable`}
                            bus={{ ...bus, updnLine: "down" }}
                            isLast={i === arr.length - 1}
                            onArrow={() => {
                              setDetailMeta({
                                station: activeDownTab,
                                route: bus.routeName,
                              });
                              setView("detail");
                            }}
                          />
                        ))}

                        <div className="mt-[8px] relative">
                          <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                          <button
                            onClick={() => setShowDownTimetable(false)}
                            className="w-full flex justify-center items-center gap-[12px]
              text-[12px] leading-[14px] font-medium text-[#BABBBd]
              h-[48px] bg-white px-[16px] hover:bg-[#F6F7F9]
              rounded-b-[12px]"
                          >
                            <span>예상시간표</span>
                            <img
                              src="/icons/arrow_up.svg"
                              alt="접기"
                              className="w-[16px] h-[16px]"
                            />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute top-0 left-[16px] right-[16px] h-[1px] bg-[#E6E7E9]" />
                        <button
                          onClick={() => setShowDownTimetable(true)}
                          className="w-full flex justify-center items-center gap-[6px]
            text-[12px] text-[#BABBBd] h-[48px]
            bg-white px-[16px] hover:bg-[#F6F7F9]"
                        >
                          <span>예상시간표</span>
                          <img
                            src="/icons/arrow_under.svg"
                            alt="펼치기"
                            className="w-[16px] h-[16px]"
                          />
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </section>
        </main>

        <div className="border-t border-[#E6E7E9] mt-[100px] pb-[90px]">
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

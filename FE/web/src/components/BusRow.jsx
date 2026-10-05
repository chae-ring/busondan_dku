import React from "react";
import { getBusColor, directionMap } from "../utils/helpers";

export default function BusRow({ bus, isLast, onArrow }) {
  const validNumber = (val) =>
    val !== null && val !== undefined && val !== "" && !isNaN(Number(val));

  const hasInfo =
    (typeof bus.primaryMinutes === "string" &&
      isNaN(Number(bus.primaryMinutes))) ||
    validNumber(bus.primaryMinutes);
  const p = hasInfo ? Math.floor(Number(bus.primaryMinutes)) : null;

  let primaryText = "";

  if (
    typeof bus.primaryMinutes === "string" &&
    isNaN(Number(bus.primaryMinutes))
  ) {
    primaryText = bus.primaryMinutes;
  } else if (hasInfo) {
    primaryText = p <= 1 ? "곧 도착" : `${p}분 후`;
  } else {
    primaryText = "운행 정보 없음";
  }

  const s = validNumber(bus.secondaryMinutes)
    ? Math.floor(Number(bus.secondaryMinutes))
    : null;
  const secondaryText = s !== null ? (s <= 1 ? "곧 도착" : `${s}분 후`) : null;

  return (
    <div className="px-[16px]" onClick={onArrow}>
      <style>{`
        @keyframes softBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.48; }
        }
        .soft-blinking {
          animation: softBlink 2.78s ease-in-out infinite;
        }
      `}</style>
      <div
        className={`flex justify-between items-center h-[76px] border-b border-[#E6E7E9] cursor-pointer active:bg-[#F6F7F9] transition ${
          isLast ? "border-none" : ""
        }`}
      >
        <div className="flex flex-col justify-between h-full py-[16px]">
          <h3
            className={`font-pretendard font-bold text-[18px] leading-[22px] ${getBusColor(
              bus.routeName
            )}`}
          >
            {bus.routeName}
          </h3>
          <p className="font-pretendard text-[12px] leading-[14px] font-medium text-[#828386] mt-[6px]">
            {bus.direction || directionMap[bus.updnLine]?.[bus.routeName]}
          </p>
        </div>

        <div className="flex items-center justify-end w-[160px]">
          <div className="flex flex-col items-end justify-between h-full py-[16px]">
            {hasInfo ? (
              <>
                <div className="flex items-center justify-end space-x-[6px]">
                  {bus.routeName === "셔틀버스" &&
                    bus.primaryMinutes !== "수시 운행 중" &&
                    bus.primaryMinutes !== null &&
                    bus.primaryMinutes !== "" &&
                    bus.primaryMinutes !== undefined && (
                      <p className="text-[10px] leading-[14px] font-medium text-[#828386] bg-[#E6E7E9] px-[4px] py-[2px] rounded-[5px]">
                        시간표 기준
                      </p>
                    )}

                  {bus.routeName !== "셔틀버스" && bus.type === "live" && (
                    <p className="soft-blinking text-[10px] leading-[14px] font-medium text-[#2373FF] bg-[#DBE8FF] px-[4px] py-[2px] rounded-[5px]">
                      실시간
                    </p>
                  )}
                  {bus.routeName !== "셔틀버스" && bus.type === "timetable" && (
                    <p className="text-[10px] leading-[14px] font-medium text-[#828386] bg-[#E6E7E9] px-[4px] py-[2px] rounded-[5px]">
                      시간표 기준
                    </p>
                  )}

                  <p className="text-[16px] leading-[20px] font-bold text-[#212326]">
                    {primaryText}
                  </p>
                </div>
                {secondaryText && (
                  <p className="text-[14px] leading-[18px] font-semibold text-[#BABBBd] mt-[6px]">
                    {secondaryText}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12px] leading-[14px] font-normal text-[#BABBBd]">
                운행 정보 없음
              </p>
            )}
          </div>

          <img
            src="/icons/more.svg"
            alt="more"
            className="w-[14px] h-[14px] opacity-60 ml-[12px] pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}

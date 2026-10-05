import React from "react";

export default function Tab({ name, activeTab, setActiveTab }) {
  return (
    <button
      onClick={() => setActiveTab(name)}
      className={`px-[16px] py-[8px] h-[34px] rounded-[17px] text-[14px] leading-[18px] font-pretendard transition-all whitespace-nowrap border ${
        activeTab === name
          ? "bg-white text-[#2373FF] border-[#2373FF] font-bold shadow-sm"
          : "bg-white text-[#BABBBd] border-[#E6E7E9] font-medium"
      }`}
      style={
        activeTab === name
          ? { boxShadow: "0 0 4px 0 rgba(35, 115, 255, 0.3)" }
          : {}
      }
    >
      {name}
    </button>
  );
}

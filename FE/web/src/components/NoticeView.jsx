import React, { useEffect, useState } from "react";
import { API_BASE } from "../utils/helpers";

export default function NoticeView({ onBack }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [failCount, setFailCount] = useState(0);

  const fetchNotices = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      setNotices(data.notifications || []);
      setFailCount(0);
      setError(null);
    } catch (err) {
      console.error(err);
      setFailCount((prev) => prev + 1);
      if (failCount + 1 >= 10) setError("공지사항을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const formatDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="bg-white min-h-screen w-full max-w-[393px] mx-auto font-pretendard relative pt-[env(safe-area-inset-top)]  overscroll-none">
      <header className="relative w-full h-[58px] border-b border-[#E6E7E9] flex items-end pb-[12px] px-[20px]">
        <div className="flex items-center space-x-[20px]">
          <button
            onClick={() => {
              const ids = notices.map((n) => String(n.id));
              localStorage.setItem("prevNoticeIds", JSON.stringify(ids));

              if (typeof window.setHasNewNotice === "function") {
                window.setHasNewNotice(false);
              }

              onBack();
            }}
          >
            <img
              src="/icons/back.svg"
              alt="뒤로가기"
              className="w-[24px] h-[24px] object-contain"
            />
          </button>

          <h1 className="text-[20px] leading-[24px] font-bold text-[#212326]">
            공지사항
          </h1>
        </div>
      </header>

      <main className="px-[20px] pt-[1px] pb-[40px]">
        {loading ? (
          <div className="flex justify-center items-center h-[100px]">
            <p className="text-[#BABBBd] text-[14px]">불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-[100px]">
            <p className="text-[#BABBBd] text-[14px]">{error}</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="flex justify-center items-center h-[100px]">
            <p className="text-[#BABBBd] text-[14px]">공지사항이 없습니다.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-[#E6E7E9]">
            {notices.map((notice) => (
              <li
                key={notice.id}
                className="py-[16px] cursor-pointer"
                onClick={() => {
                  if (notice.linkUrl) window.open(notice.linkUrl, "_blank");
                }}
              >
                <p className="text-[16px] leading-[20px] font-medium text-[#212326]">
                  {notice.title}
                </p>
                <p className="text-[14px] leading-[18px] text-[#babbbd] mt-[6px]">
                  {formatDate(notice.createdAt)}
                </p>
              </li>
            ))}
            <div className="bg-[#E6E7E9]" />
          </ul>
        )}
      </main>
    </div>
  );
}

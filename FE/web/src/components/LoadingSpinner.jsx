import React from "react";

export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      <p className="ml-4 text-gray-600">버스 정보를 불러오는 중...</p>
    </div>
  );
}
